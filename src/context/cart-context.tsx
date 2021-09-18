import { isWithinInterval } from "date-fns";
import { createContext, useContext, useEffect, useState } from "react";
import {
    EDiscountType,
    EPromotionType,
    ERegisterType,
    IGET_DASHBOARD_PROMOTION,
    IGET_DASHBOARD_PROMOTION_DISCOUNT,
    IGET_DASHBOARD_PROMOTION_ITEMS,
} from "../graphql/customQueries";

import { ICartProduct, EOrderType, ICartItemQuantitiesById, ICartPromotion } from "../model/model";
import { getMatchingPromotionProducts, processPromotionDiscounts, isPromotionAvailable } from "../util/util";
import { useRestaurant } from "./restaurant-context";

const initialOrderType = null;
const initialTableNumber = null;
const initialProducts = null;
const initialNotes = "";
const initialCartCategoryQuantitiesById = {};
const initialCartProductQuantitiesById = {};
const initialCartModifierQuantitiesById = {};
const initialPromotion = null;
const initialTotal = 0;
const initialSubTotal = 0;

type ContextProps = {
    // restaurant: IGET_RESTAURANT | null;
    // setRestaurant: (restaurant: IGET_RESTAURANT) => void;
    orderType: EOrderType | null;
    setOrderType: (orderType: EOrderType) => void;
    tableNumber: string | null;
    setTableNumber: (tableNumber: string) => void;
    products: ICartProduct[] | null;
    cartProductQuantitiesById: ICartItemQuantitiesById;
    cartModifierQuantitiesById: ICartItemQuantitiesById;
    addItem: (product: ICartProduct) => void;
    updateItem: (index: number, product: ICartProduct) => void;
    updateItemQuantity: (index: number, quantity: number) => void;
    deleteItem: (index: number) => void; // has a index input because multiple products in cart could have the same id
    clearCart: () => void;
    notes: string;
    setNotes: (notes: string) => void;
    promotion: ICartPromotion | null;
    total: number;
    subTotal: number;
};

const CartContext = createContext<ContextProps>({
    // restaurant: initialRestaurant,
    // setRestaurant: () => {},
    orderType: initialOrderType,
    setOrderType: () => {},
    tableNumber: initialTableNumber,
    setTableNumber: () => {},
    products: initialProducts,
    cartProductQuantitiesById: {},
    cartModifierQuantitiesById: {},
    addItem: () => {},
    updateItem: () => {},
    updateItemQuantity: () => {},
    deleteItem: () => {},
    clearCart: () => {},
    notes: initialNotes,
    setNotes: () => {},
    promotion: initialPromotion,
    total: initialTotal,
    subTotal: initialSubTotal,
});

const CartProvider = (props: { children: React.ReactNode }) => {
    const { restaurant } = useRestaurant();

    const [orderType, _setOrderType] = useState<EOrderType | null>(initialOrderType);
    const [tableNumber, _setTableNumber] = useState<string | null>(initialTableNumber);
    const [products, _setProducts] = useState<ICartProduct[] | null>(initialProducts);
    const [notes, _setNotes] = useState<string>(initialNotes);
    const [total, _setTotal] = useState<number>(initialTotal);
    const [subTotal, _setSubTotal] = useState<number>(initialSubTotal);
    const [promotion, _setPromotion] = useState<ICartPromotion | null>(initialPromotion);

    const [cartCategoryQuantitiesById, _setCartCategoryQuantitiesById] = useState<ICartItemQuantitiesById>(initialCartCategoryQuantitiesById);
    const [cartProductQuantitiesById, _setCartProductQuantitiesById] = useState<ICartItemQuantitiesById>(initialCartProductQuantitiesById);
    const [cartModifierQuantitiesById, _setCartModifierQuantitiesById] = useState<ICartItemQuantitiesById>(initialCartModifierQuantitiesById);
    const [availablePromotions, _setAvailablePromotions] = useState<IGET_DASHBOARD_PROMOTION[]>([]);

    useEffect(() => {
        if (promotion) {
            _setSubTotal(total - promotion.discountedAmount);
        } else {
            _setSubTotal(total);
        }
    }, [total, promotion]);

    useEffect(() => {
        const now = new Date();

        const availPromotions: IGET_DASHBOARD_PROMOTION[] = [];

        restaurant &&
            restaurant.promotions.items.forEach((promotion) => {
                if (!promotion.autoApply) return;

                const platform = process.env.REACT_APP_PLATFORM;

                if (!platform || !promotion.availablePlatforms) return;
                if (!promotion.availablePlatforms.includes(ERegisterType[platform])) return;

                const startDate = new Date(promotion.startDate);
                const endDate = new Date(promotion.endDate);

                const isWithin = isWithinInterval(now, { start: startDate, end: endDate });

                if (!isWithin) return;

                const isAvailable = promotion.availability && isPromotionAvailable(promotion.availability);

                if (!isAvailable) return;

                availPromotions.push(promotion);
            });

        _setAvailablePromotions(availPromotions);
    }, [restaurant]);

    const getEntireOrderDiscountAmount = (promotion: IGET_DASHBOARD_PROMOTION, total: number) => {
        const bestPromotionDiscount = processPromotionDiscounts(
            cartCategoryQuantitiesById,
            cartProductQuantitiesById,
            promotion.discounts.items,
            undefined,
            total
        );

        return {
            matchingProducts: {},
            discountedAmount: bestPromotionDiscount.discountedAmount,
        };
    };

    const getComboDiscountAmount = (promotion: IGET_DASHBOARD_PROMOTION) => {
        const matchingProducts = getMatchingPromotionProducts(
            cartCategoryQuantitiesById,
            cartProductQuantitiesById,
            promotion.items.items,
            promotion.applyToCheapest
        );

        if (!matchingProducts)
            return {
                matchingProducts: {},
                discountedAmount: 0,
            };

        const bestPromotionDiscount = processPromotionDiscounts(
            cartCategoryQuantitiesById,
            cartProductQuantitiesById,
            promotion.discounts.items,
            matchingProducts,
            undefined,
            promotion.applyToCheapest
        );

        return {
            matchingProducts: bestPromotionDiscount.matchingProducts,
            discountedAmount: bestPromotionDiscount.discountedAmount,
        };
    };

    const getRelatedItemsDiscountAmount = (promotion: IGET_DASHBOARD_PROMOTION) => {
        const matchingProducts = getMatchingPromotionProducts(
            cartCategoryQuantitiesById,
            cartProductQuantitiesById,
            promotion.items.items,
            promotion.applyToCheapest
        );

        if (!matchingProducts)
            return {
                matchingProducts: {},
                discountedAmount: 0,
            };

        const bestPromotionDiscount = processPromotionDiscounts(
            cartCategoryQuantitiesById,
            cartProductQuantitiesById,
            promotion.discounts.items,
            matchingProducts,
            undefined,
            promotion.applyToCheapest
        );

        return {
            matchingProducts: bestPromotionDiscount.matchingProducts,
            discountedAmount: bestPromotionDiscount.discountedAmount,
        };
    };

    useEffect(() => {
        if (availablePromotions.length == 0) return;
        if (!products || products.length == 0) return;

        let bestPromotion: ICartPromotion | null = null;

        availablePromotions.forEach((promotion) => {
            if (!orderType || !promotion.availableOrderTypes) return;
            if (!promotion.availableOrderTypes.includes(EOrderType[orderType])) return;

            if (total < promotion.minSpend) return;

            let discount: {
                matchingProducts: ICartItemQuantitiesById;
                discountedAmount: number;
            } = {
                matchingProducts: {},
                discountedAmount: 0,
            };

            switch (promotion.type) {
                case EPromotionType.COMBO:
                    discount = getComboDiscountAmount(promotion);
                    break;
                case EPromotionType.ENTIREORDER:
                    discount = getEntireOrderDiscountAmount(promotion, total);
                    break;
                case EPromotionType.RELATEDITEMS:
                    discount = getRelatedItemsDiscountAmount(promotion);
                    break;
                default:
                    break;
            }

            if (!(discount.discountedAmount > 0)) return;

            if (!bestPromotion || discount.discountedAmount > bestPromotion.discountedAmount) {
                bestPromotion = {
                    discountedAmount: discount.discountedAmount,
                    matchingProducts: discount.matchingProducts,
                    promotion: promotion,
                };
            }
        });

        _setPromotion(bestPromotion);
    }, [cartProductQuantitiesById, cartModifierQuantitiesById, availablePromotions, orderType]);

    const updateCartQuantities = (products: ICartProduct[] | null) => {
        const newCartCategoryQuantitiesById: ICartItemQuantitiesById = {};
        const newCartProductQuantitiesById: ICartItemQuantitiesById = {};
        const newCartModifierQuantitiesById: ICartItemQuantitiesById = {};

        products &&
            products.forEach((product) => {
                if (newCartCategoryQuantitiesById[product.category.id]) {
                    //We use product.quantity here because category does not have quantity assigned to it. The number of products select is same as the quantity for the category.
                    newCartCategoryQuantitiesById[product.category.id].quantity += product.quantity;
                } else {
                    newCartCategoryQuantitiesById[product.category.id] = {
                        id: product.category.id,
                        name: product.category.name,
                        quantity: product.quantity,
                        price: product.price,
                    };
                }

                //We do this because there could be the same product in the products array twice.
                if (newCartProductQuantitiesById[product.id]) {
                    newCartProductQuantitiesById[product.id].quantity += product.quantity;
                } else {
                    newCartProductQuantitiesById[product.id] = {
                        id: product.id,
                        name: product.name,
                        quantity: product.quantity,
                        price: product.price,
                        categoryId: product.category.id,
                    };
                }

                product.modifierGroups.forEach((modifierGroup) => {
                    modifierGroup.modifiers.forEach((modifier) => {
                        if (modifier.productModifier) {
                            if (newCartProductQuantitiesById[modifier.productModifier.id]) {
                                newCartProductQuantitiesById[modifier.productModifier.id].quantity += product.quantity * modifier.quantity;
                            } else {
                                newCartProductQuantitiesById[modifier.productModifier.id] = {
                                    id: product.id,
                                    name: product.name,
                                    quantity: product.quantity,
                                    price: product.price,
                                    categoryId: product.category.id,
                                };
                            }
                        } else {
                            if (newCartModifierQuantitiesById[modifier.id]) {
                                newCartModifierQuantitiesById[modifier.id].quantity += product.quantity * modifier.quantity;
                            } else {
                                newCartModifierQuantitiesById[modifier.id] = {
                                    id: product.id,
                                    name: product.name,
                                    quantity: product.quantity,
                                    price: product.price,
                                };
                            }
                        }
                    });
                });
            });

        _setCartCategoryQuantitiesById(newCartCategoryQuantitiesById);
        _setCartProductQuantitiesById(newCartProductQuantitiesById);
        _setCartModifierQuantitiesById(newCartModifierQuantitiesById);
    };

    const recalculateTotal = (products: ICartProduct[] | null) => {
        let totalPrice = 0;

        products &&
            products.forEach((p) => {
                totalPrice += p.price * p.quantity;
                p.modifierGroups.forEach((mg) => {
                    mg.modifiers.forEach((m) => {
                        const changedQuantity = m.quantity - m.preSelectedQuantity;

                        if (changedQuantity > 0) {
                            totalPrice += m.price * changedQuantity * p.quantity;
                        }
                    });
                });
            });

        return totalPrice;
    };

    const setOrderType = (orderType: EOrderType) => {
        _setOrderType(orderType);
    };

    const setTableNumber = (tableNumber: string) => {
        _setTableNumber(tableNumber);
    };

    const addItem = (product: ICartProduct) => {
        let newProducts = products;

        if (newProducts != null) {
            newProducts.push(product);
        } else {
            newProducts = [product];
        }

        _setProducts(newProducts);
        _setTotal(recalculateTotal(newProducts));
        updateCartQuantities(newProducts);
    };

    const updateItem = (index: number, product: ICartProduct) => {
        if (products == null) {
            // should never really end up here
            return;
        }

        const newProducts = products;
        newProducts[index] = product;

        _setProducts(newProducts);
        _setTotal(recalculateTotal(newProducts));
        updateCartQuantities(newProducts);
    };

    const updateItemQuantity = (index: number, quantity: number) => {
        if (products == null) {
            // should never really end up here
            return;
        }

        const newProducts = products;
        const productAtIndex = newProducts[index];

        productAtIndex.quantity = quantity;
        newProducts[index] = productAtIndex;

        _setProducts(newProducts);
        _setTotal(recalculateTotal(newProducts));
        updateCartQuantities(newProducts);
    };

    const deleteItem = (index: number) => {
        if (products == null) {
            // should never really end up here
            return;
        }

        let newProducts = products;
        newProducts.splice(index, 1);

        _setProducts(newProducts);
        _setTotal(recalculateTotal(newProducts));
        updateCartQuantities(newProducts);
    };

    const clearCart = () => {
        _setOrderType(initialOrderType);
        _setTableNumber(initialTableNumber);
        _setProducts(initialProducts);
        _setNotes(initialNotes);
        _setCartCategoryQuantitiesById(initialCartCategoryQuantitiesById);
        _setCartProductQuantitiesById(initialCartProductQuantitiesById);
        _setCartModifierQuantitiesById(initialCartModifierQuantitiesById);
        _setPromotion(initialPromotion);
        _setTotal(initialTotal);
        _setSubTotal(initialSubTotal);
    };

    const setNotes = (notes: string) => {
        _setNotes(notes);
    };

    return (
        <CartContext.Provider
            value={{
                // restaurant: restaurant,
                // setRestaurant: setRestaurant,
                orderType: orderType,
                setOrderType: setOrderType,
                tableNumber: tableNumber,
                setTableNumber: setTableNumber,
                products: products,
                cartProductQuantitiesById: cartProductQuantitiesById,
                cartModifierQuantitiesById: cartModifierQuantitiesById,
                addItem: addItem,
                updateItem: updateItem,
                updateItemQuantity: updateItemQuantity,
                deleteItem: deleteItem,
                clearCart: clearCart,
                notes: notes,
                setNotes: setNotes,
                promotion: promotion,
                total: total,
                subTotal: subTotal,
            }}
            children={props.children}
        />
    );
};

const useCart = () => {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error(`useCart must be used within a CartProvider`);
    }
    return context;
};

export { CartProvider, useCart };
