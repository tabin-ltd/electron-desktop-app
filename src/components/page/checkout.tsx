import { useState, useEffect } from "react";

import { Logger } from "aws-amplify";
import { useCart } from "../../context/cart-context";
import { useHistory } from "react-router-dom";
import { convertCentsToDollars, convertProductTypesForPrint, filterPrintProducts, getOrderNumber } from "../../util/util";
import { useMutation } from "@apollo/client";
import { CREATE_ORDER } from "../../graphql/customMutations";
import { IGET_RESTAURANT_REGISTER_PRINTER, IGET_RESTAURANT_CATEGORY, IGET_RESTAURANT_PRODUCT, EPromotionType } from "../../graphql/customQueries";
import { restaurantPath, beginOrderPath, tableNumberPath, orderTypePath } from "../main";
import { ShoppingBasketIcon } from "../../tabin/components/icons/shoppingBasketIcon";
import { ProductModal } from "../modals/product";
import {
    ICartProduct,
    IPreSelectedModifiers,
    ICartModifierGroup,
    EOrderType,
    IMatchingUpSellCrossSellProductItem,
    IMatchingUpSellCrossSellCategoryItem,
    ECheckoutTransactionOutcome,
} from "../../model/model";
import { useUser } from "../../context/user-context";
import { format } from "date-fns";
import { PageWrapper } from "../../tabin/components/pageWrapper";
import { useSmartpay, SmartpayTransactionOutcome } from "../../context/smartpay-context";
import { Modal } from "../../tabin/components/modal";
import { Button } from "../../tabin/components/button";
import { ItemAddedUpdatedModal } from "../modals/itemAddedUpdatedModal";
import { Stepper } from "../../tabin/components/stepper";
import { useVerifone, VerifoneTransactionOutcome } from "../../context/verifone-context";
import { useRegister } from "../../context/register-context";
import { useReceiptPrinter } from "../../context/receiptPrinter-context";
import { getPublicCloudFrontDomainName } from "../../private/aws-custom";
import { toLocalISOString } from "../../util/util";
import { useRestaurant } from "../../context/restaurant-context";
import { UpSellProductModal } from "../modals/upSellProduct";
import { Link } from "../../tabin/components/link";
import { TextArea } from "../../tabin/components/textArea";

import "./checkout.scss";
import { useWindcave, WindcaveTransactionOutcome, WindcaveTransactionOutcomeResult } from "../../context/windcave-context";
import { CachedImage } from "../../tabin/components/cachedImage";
import { UpSellCategoryModal } from "../modals/upSellCategory";
import { useErrorLogging } from "../../context/errorLogging-context";
import { PromotionCodeModal } from "../modals/promotionCodeModal";
import { IGET_RESTAURANT_ORDER_FRAGMENT } from "../../graphql/customFragments";
import { OrderSummary } from "./checkout/orderSummary";
import { PaymentModal } from "../modals/paymentModal";

const logger = new Logger("checkout");

// Component
export const Checkout = () => {
    // context
    const history = useHistory();
    const {
        orderType,
        products,
        notes,
        setNotes,
        tableNumber,
        clearCart,
        promotion,
        total,
        subTotal,
        updateItem,
        updateItemQuantity,
        deleteItem,
        addItem,
        userAppliedPromotionCode,
        removeUserAppliedPromotion,
    } = useCart();
    const { restaurant } = useRestaurant();
    const { printReceipt } = useReceiptPrinter();
    const { user } = useUser();
    const { logError } = useErrorLogging();

    const { createTransaction: smartpayCreateTransaction, pollForOutcome: smartpayPollForOutcome } = useSmartpay();
    const { createTransaction: verifoneCreateTransaction } = useVerifone();
    const { createTransaction: windcaveCreateTransaction, pollForOutcome: windcavePollForOutcome } = useWindcave();

    const [createOrderMutation, { data, loading, error }] = useMutation(CREATE_ORDER, {
        update: (proxy, mutationResult) => {
            logger.debug("mutation result: ", mutationResult);
        },
    });

    // state
    const [selectedCategoryForProductModal, setSelectedCategoryForProductModal] = useState<IGET_RESTAURANT_CATEGORY | null>(null);
    const [selectedProductForProductModal, setSelectedProductForProductModal] = useState<IGET_RESTAURANT_PRODUCT | null>(null);
    const [productToEdit, setProductToEdit] = useState<{
        product: ICartProduct;
        displayOrder: number;
    } | null>(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [showEditProductModal, setShowEditProductModal] = useState(false);
    const [showItemUpdatedModal, setShowItemUpdatedModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentOutcome, setPaymentOutcome] = useState<ECheckoutTransactionOutcome | null>(null);
    const [paymentOutcomeErrorMessage, setPaymentOutcomeErrorMessage] = useState<string | null>(null);
    const [paymentOutcomeDelayedOrderNumber, setPaymentOutcomeDelayedOrderNumber] = useState<string | null>(null);
    const [paymentOutcomeApprovedRedirectTimeLeft, setPaymentOutcomeApprovedRedirectTimeLeft] = useState(10);
    const [createOrderError, setCreateOrderError] = useState<string | null>(null);
    const [showPromotionCodeModal, setShowPromotionCodeModal] = useState(false);
    const [showUpSellCategoryModal, setShowUpSellCategoryModal] = useState(false);
    const [showUpSellProductModal, setShowUpSellProductModal] = useState(false);

    // const isUserFocusedOnEmailAddressInput = useRef(false);

    const { register } = useRegister();

    if (!register) {
        throw "Register is not valid";
    }

    useEffect(() => {
        setTimeout(() => {
            setShowUpSellCategoryModal(true);
        }, 1000);
    }, []);

    if (!restaurant) {
        history.push(beginOrderPath);
    }

    if (!restaurant) {
        throw "Restaurant is invalid";
    }

    const onCancelOrder = () => {
        clearCart();
        history.push(beginOrderPath);
    };

    // Modal callbacks
    const onCloseProductModal = () => {
        setShowProductModal(false);
    };

    const onClosePromotionCodeModal = () => {
        setShowPromotionCodeModal(false);
    };

    const onCloseEditProductModal = () => {
        setProductToEdit(null);
        setShowEditProductModal(false);
    };

    const onCloseUpSellCategoryModal = () => {
        setShowUpSellCategoryModal(false);
    };

    const onCloseUpSellProductModal = () => {
        setShowUpSellProductModal(false);
    };

    const onCloseItemUpdatedModal = () => {
        setShowItemUpdatedModal(false);
    };

    // Callbacks
    const onUpdateTableNumber = () => {
        history.push(tableNumberPath);
    };

    const onUpdateOrderType = () => {
        history.push(orderTypePath);
    };

    const onNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
    };

    const onAddItem = (product: ICartProduct) => {
        addItem(product);
    };

    const onSelectUpSellCrossSellCategory = (category: IGET_RESTAURANT_CATEGORY) => {
        history.push(`${restaurantPath}/${restaurant.id}/${category.id}`);
    };

    const onSelectUpSellCrossSellProduct = (category: IGET_RESTAURANT_CATEGORY, product: IGET_RESTAURANT_PRODUCT) => {
        if (product.modifierGroups && product.modifierGroups.items.length > 0) {
            setSelectedCategoryForProductModal(category);
            setSelectedProductForProductModal(product);

            setShowProductModal(true);
        } else {
            addItem({
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image
                    ? {
                          key: product.image.key,
                          region: product.image.region,
                          bucket: product.image.bucket,
                          identityPoolId: product.image.identityPoolId,
                      }
                    : null,
                quantity: 1,
                notes: null,
                category: {
                    id: category.id,
                    name: category.name,
                    image: category.image
                        ? {
                              key: category.image.key,
                              region: category.image.region,
                              bucket: category.image.bucket,
                              identityPoolId: category.image.identityPoolId,
                          }
                        : null,
                },
                modifierGroups: [],
            });
        }

        setShowUpSellProductModal(false);
    };

    const onEditProduct = (product: ICartProduct, displayOrder: number) => {
        setProductToEdit({ product, displayOrder });
        setShowEditProductModal(true);
    };

    const onUpdateProductQuantity = (displayOrder: number, productQuantity: number) => {
        updateItemQuantity(displayOrder, productQuantity);
    };

    const onRemoveProduct = (displayOrder: number) => {
        deleteItem(displayOrder);
    };

    const onClickOrderButton = async () => {
        setShowPaymentModal(true);

        await onConfirmTotalOrRetryTransaction();
    };

    const onClosePaymentModal = () => {
        setPaymentOutcome(null);
        setPaymentOutcomeErrorMessage(null);
        setPaymentOutcomeDelayedOrderNumber(null);
        setPaymentOutcomeApprovedRedirectTimeLeft(10);

        setShowPaymentModal(false);
    };

    const beginPaymentOutcomeApprovedTimeout = () => {
        (function timerLoop(i) {
            setTimeout(() => {
                i--;
                setPaymentOutcomeApprovedRedirectTimeLeft(i);

                if (i == 0) {
                    history.push(beginOrderPath);
                    clearCart();
                }

                if (i > 0) timerLoop(i); //  decrement i and call myLoop again if i > 0
            }, 1000);
        })(10);
    };

    const printReceipts = (order: IGET_RESTAURANT_ORDER_FRAGMENT) => {
        if (!products || products.length == 0) {
            return;
        }

        register.printers &&
            register.printers.items.forEach(async (printer) => {
                const productsToPrint = filterPrintProducts(products, printer);

                if (productsToPrint.length > 0) {
                    await printReceipt({
                        orderId: order.id,
                        printerType: printer.type,
                        printerAddress: printer.address,
                        customerPrinter: printer.customerPrinter,
                        kitchenPrinter: printer.kitchenPrinter,
                        hideModifierGroupsForCustomer: false,
                        restaurant: {
                            name: restaurant.name,
                            address: `${restaurant.address.aptSuite || ""} ${restaurant.address.formattedAddress || ""}`,
                            gstNumber: restaurant.gstNumber,
                        },
                        customerInformation: null,
                        notes: order.notes,
                        products: convertProductTypesForPrint(order.products),
                        eftposReceipt: order.eftposReceipt,
                        total: order.total,
                        discount: order.promotionId && order.discount ? order.discount : null,
                        subTotal: order.subTotal,
                        paid: order.paid,
                        type: order.type,
                        number: order.number,
                        table: order.table,
                        placedAt: order.placedAt,
                        orderScheduledAt: order.orderScheduledAt,
                    });
                }
            });
    };

    const onSubmitOrder = async (paid: boolean, eftposReceipt: string | null) => {
        const orderNumber = getOrderNumber(register.orderNumberSuffix);
        setPaymentOutcomeDelayedOrderNumber(orderNumber);

        try {
            const newOrder: IGET_RESTAURANT_ORDER_FRAGMENT = await createOrder(orderNumber, paid, eftposReceipt);

            if (register.printers && register.printers.items.length > 0) {
                await printReceipts(newOrder);
            }
        } catch (e) {
            throw e.message;
        }

        beginPaymentOutcomeApprovedTimeout();
    };

    // Submit callback
    const createOrder = async (orderNumber: string, paid: boolean, eftposReceipt: string | null): Promise<IGET_RESTAURANT_ORDER_FRAGMENT> => {
        const now = new Date();

        if (!user) {
            await logError("Invalid user", JSON.stringify({ user: user }));
            throw "Invalid user";
        }

        if (!orderType) {
            await logError("Invalid order type", JSON.stringify({ orderType: orderType }));
            throw "Invalid order type";
        }

        if (!restaurant) {
            await logError("Invalid restaurant", JSON.stringify({ restaurant: restaurant }));
            throw "Invalid restaurant";
        }

        if (!products || products.length == 0) {
            await logError("No products have been selected", JSON.stringify({ products: products }));
            throw "No products have been selected";
        }

        let variables;

        try {
            variables = {
                status: "NEW",
                paid: paid,
                type: orderType,
                number: orderNumber,
                table: tableNumber,
                notes: notes,
                eftposReceipt: eftposReceipt,
                total: total,
                discount: promotion ? promotion.discountedAmount : undefined,
                promotionId: promotion ? promotion.promotion.id : undefined,
                subTotal: subTotal,
                registerId: register.id,
                products: JSON.parse(JSON.stringify(products)) as ICartProduct[], // copy obj so we can mutate it later
                placedAt: toLocalISOString(now),
                placedAtUtc: now.toISOString(),
                orderUserId: user.id,
                orderRestaurantId: restaurant.id,
            };

            if (restaurant.autoCompleteOrders) {
                variables.status = "COMPLETED";
                variables.completedAt = toLocalISOString(now);
                variables.completedAtUtc = now.toISOString();
                variables.paid = true;
            }
        } catch (e) {
            await logError(
                "Error in createOrderMutation input",
                JSON.stringify({
                    status: "NEW",
                    paid: paid,
                    type: orderType,
                    number: orderNumber,
                    table: tableNumber,
                    notes: notes,
                    eftposReceipt: eftposReceipt,
                    total: total,
                    discount: promotion ? promotion.discountedAmount : undefined,
                    promotionId: promotion ? promotion.promotion.id : undefined,
                    subTotal: subTotal,
                    registerId: register.id,
                    products: JSON.stringify(products), // copy obj so we can mutate it later
                    placedAt: now,
                    placedAtUtc: now,
                    orderUserId: user.id,
                    orderRestaurantId: restaurant.id,
                })
            );
            throw "Error in createOrderMutation input";
        }

        try {
            if (tableNumber == null || tableNumber == "") {
                delete variables.table;
            }

            if (notes == null || notes == "") {
                delete variables.notes;
            }

            variables.products.forEach((product) => {
                if (product.modifierGroups.length == 0) {
                    delete product.modifierGroups;
                }

                if (product.image == null) {
                    delete product.image;
                }

                if (product.notes == null || product.notes == "") {
                    delete product.notes;
                }

                if (product.category.image == null) {
                    delete product.category.image;
                }
            });

            // process order
            const res: any = await createOrderMutation({
                variables: variables,
            });

            console.log("process order mutation result: ", res);

            return res.data.createOrder;
        } catch (e) {
            console.log("process order mutation error: ", e);

            await logError(e, JSON.stringify({ error: e, variables: variables }));
            throw e;
        }
    };

    const doTransaction = async () => {
        if (register.eftposProvider == "SMARTPAY") {
            await doTransactionSmartpay();
        } else if (register.eftposProvider == "VERIFONE") {
            await doTransactionVerifone();
        } else if (register.eftposProvider == "WINDCAVE") {
            await doTransactionWindcave();
        }
    };

    const doTransactionSmartpay = async () => {
        let delayedShown = false;

        let delayed = () => {
            if (!delayedShown) {
                // Don't show it more than once per request...
                delayedShown = true;

                // Might want to let the user know to check if everything is ok with the device
                setPaymentOutcome(ECheckoutTransactionOutcome.Delay);
            }
        };

        try {
            let pollingUrl = await smartpayCreateTransaction(subTotal, "Card.Purchase");

            let transactionOutcome: SmartpayTransactionOutcome = await smartpayPollForOutcome(pollingUrl, delayed);

            if (transactionOutcome == SmartpayTransactionOutcome.Accepted) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Success);

                try {
                    await onSubmitOrder(true, null);
                } catch (e) {
                    setCreateOrderError(e);
                }
            } else if (transactionOutcome == SmartpayTransactionOutcome.Declined) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Declined! Please try again.");
            } else if (transactionOutcome == SmartpayTransactionOutcome.Cancelled) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Cancelled!");
            } else if (transactionOutcome == SmartpayTransactionOutcome.DeviceOffline) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Cancelled! Please check if the device is powered on and online.");
            } else {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
            }
        } catch (errorMessage) {
            setPaymentOutcomeErrorMessage(errorMessage);
        }
    };

    const doTransactionWindcave = async () => {
        try {
            const txnRef = await windcaveCreateTransaction(register.windcaveStationId, subTotal, "Purchase");

            let transactionOutcome: WindcaveTransactionOutcomeResult = await windcavePollForOutcome(register.windcaveStationId, txnRef);

            if (transactionOutcome.transactionOutcome == WindcaveTransactionOutcome.Accepted) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Success);

                try {
                    await onSubmitOrder(true, transactionOutcome.eftposReceipt);
                } catch (e) {
                    setCreateOrderError(e);
                }
            } else if (transactionOutcome.transactionOutcome == WindcaveTransactionOutcome.Declined) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Declined! Please try again.");
            } else if (transactionOutcome.transactionOutcome == WindcaveTransactionOutcome.Cancelled) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Cancelled!");
            } else {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
            }
        } catch (errorMessage) {
            setPaymentOutcomeErrorMessage(errorMessage);
        }
    };

    const doTransactionVerifone = async () => {
        try {
            const { transactionOutcome, eftposReceipt } = await verifoneCreateTransaction(
                subTotal,
                register.eftposIpAddress,
                register.eftposPortNumber,
                restaurant.id
            );

            if (transactionOutcome == VerifoneTransactionOutcome.Approved) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Success);

                try {
                    await onSubmitOrder(true, eftposReceipt);
                } catch (e) {
                    setCreateOrderError(e);
                }
            } else if (transactionOutcome == VerifoneTransactionOutcome.ApprovedWithSignature) {
                // We should not come in here if its on kiosk mode, unattended mode for Verifone
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Approved With Signature Not Allowed In Kiosk Mode!");
            } else if (transactionOutcome == VerifoneTransactionOutcome.Cancelled) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Cancelled!");
            } else if (transactionOutcome == VerifoneTransactionOutcome.Declined) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Declined! Please try again.");
            } else if (transactionOutcome == VerifoneTransactionOutcome.SettledOk) {
                alert("Transaction Settled Ok!");
            } else if (transactionOutcome == VerifoneTransactionOutcome.HostUnavailable) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Host Unavailable! Please check if the device is powered on and online.");
            } else if (transactionOutcome == VerifoneTransactionOutcome.SystemError) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction System Error! Please try again later.");
            } else if (transactionOutcome == VerifoneTransactionOutcome.TransactionInProgress) {
                // You should never come in this state
                // alert("Transaction In Progress!");
            } else if (transactionOutcome == VerifoneTransactionOutcome.TerminalBusy) {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Terminal Is Busy! Please cancel the previous transaction before proceeding.");
            } else {
                setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
                setPaymentOutcomeErrorMessage("Transaction Failed!");
            }
        } catch (errorMessage) {
            setPaymentOutcome(ECheckoutTransactionOutcome.Fail);
            setPaymentOutcomeErrorMessage(errorMessage);
        }
    };

    const onUpdateItem = (index: number, product: ICartProduct) => {
        updateItem(index, product);
        setShowItemUpdatedModal(true);
    };

    const onClickApplyPromotionCode = async () => {
        setShowPromotionCodeModal(true);
    };

    const onConfirmTotalOrRetryTransaction = async () => {
        setPaymentOutcome(null);
        setPaymentOutcomeErrorMessage(null);
        setPaymentOutcomeDelayedOrderNumber(null);
        setPaymentOutcomeApprovedRedirectTimeLeft(10);

        await doTransaction();
    };

    const onClickPayLater = async () => {
        setShowPaymentModal(true);

        setPaymentOutcome(ECheckoutTransactionOutcome.PayLater);
        setPaymentOutcomeErrorMessage(null);
        setPaymentOutcomeDelayedOrderNumber(null);
        setPaymentOutcomeApprovedRedirectTimeLeft(10);

        try {
            await onSubmitOrder(false, null);
        } catch (e) {
            setCreateOrderError(e);
        }
    };

    // Modals
    const editProductModal = () => {
        let category: IGET_RESTAURANT_CATEGORY | null = null;
        let product: IGET_RESTAURANT_PRODUCT | null = null;

        if (!productToEdit) {
            return <></>;
        }

        restaurant.categories.items.forEach((c) => {
            if (c.id == productToEdit.product.category.id) {
                category = c;
            }

            c.products &&
                c.products.items.forEach((p) => {
                    if (p.product.id == productToEdit.product.id) {
                        product = p.product;
                    }
                });
        });

        if (!product || !category) {
            return <></>;
        }

        let orderedModifiers: IPreSelectedModifiers = {};

        productToEdit.product.modifierGroups.forEach((mg) => {
            orderedModifiers[mg.id] = mg.modifiers;
        });

        console.log("orderedModifiers", orderedModifiers);

        return (
            <ProductModal
                category={category}
                product={product}
                isOpen={showEditProductModal}
                onClose={onCloseEditProductModal}
                onUpdateItem={onUpdateItem}
                editProduct={{
                    orderedModifiers: orderedModifiers,
                    quantity: productToEdit.product.quantity,
                    notes: productToEdit.product.notes,
                    productCartIndex: productToEdit.displayOrder,
                }}
            />
        );
    };

    const productModal = () => {
        if (selectedCategoryForProductModal && selectedProductForProductModal && showProductModal) {
            return (
                <ProductModal
                    isOpen={showProductModal}
                    category={selectedCategoryForProductModal}
                    product={selectedProductForProductModal}
                    onAddItem={onAddItem}
                    onClose={onCloseProductModal}
                />
            );
        }
    };

    const promotionCodeModal = () => {
        return <>{showPromotionCodeModal && <PromotionCodeModal isOpen={showPromotionCodeModal} onClose={onClosePromotionCodeModal} />}</>;
    };

    const upSellCategoryModal = () => {
        if (
            restaurant &&
            restaurant.upSellCrossSell &&
            restaurant.upSellCrossSell.customCategories &&
            restaurant.upSellCrossSell.customCategories.items.length > 0
        ) {
            const upSellCrossSaleCategoryItems: IMatchingUpSellCrossSellCategoryItem[] = [];

            const menuCategories = restaurant.categories.items;
            const upSellCrossSellCategories = restaurant.upSellCrossSell.customCategories.items;

            menuCategories.forEach((category) => {
                upSellCrossSellCategories.forEach((upSellCategory) => {
                    if (category.id === upSellCategory.id) {
                        upSellCrossSaleCategoryItems.push({ category: category });
                    }
                });
            });

            return (
                <UpSellCategoryModal
                    isOpen={showUpSellCategoryModal}
                    onClose={onCloseUpSellCategoryModal}
                    upSellCrossSaleCategoryItems={upSellCrossSaleCategoryItems}
                    onSelectUpSellCrossSellCategory={onSelectUpSellCrossSellCategory}
                />
            );
        }
    };

    const upSellProductModal = () => {
        if (
            restaurant &&
            restaurant.upSellCrossSell &&
            restaurant.upSellCrossSell.customProducts &&
            restaurant.upSellCrossSell.customProducts.items.length > 0
        ) {
            const upSellCrossSaleProductItems: IMatchingUpSellCrossSellProductItem[] = [];

            const menuCategories = restaurant.categories.items;
            const upSellCrossSellProducts = restaurant.upSellCrossSell.customProducts.items;

            menuCategories.forEach((category) => {
                category.products &&
                    category.products.items.forEach((p) => {
                        upSellCrossSellProducts.forEach((upSellProduct) => {
                            if (p.product.id === upSellProduct.id) {
                                upSellCrossSaleProductItems.push({ category: category, product: p.product });
                            }
                        });
                    });
            });

            return (
                <UpSellProductModal
                    isOpen={showUpSellProductModal}
                    onClose={onCloseUpSellProductModal}
                    upSellCrossSaleProductItems={upSellCrossSaleProductItems}
                    onSelectUpSellCrossSellProduct={onSelectUpSellCrossSellProduct}
                />
            );
        }
    };

    const paymentModal = (
        <>
            {showPaymentModal && (
                <PaymentModal
                    isOpen={showPaymentModal}
                    // onClose: () => void;
                    paymentOutcomeDelayedOrderNumber={paymentOutcomeDelayedOrderNumber}
                    paymentOutcomeApprovedRedirectTimeLeft={paymentOutcomeApprovedRedirectTimeLeft}
                    paymentOutcomeErrorMessage={paymentOutcomeErrorMessage}
                    createOrderError={createOrderError}
                    paymentOutcome={paymentOutcome}
                    onConfirmTotalOrRetryTransaction={onConfirmTotalOrRetryTransaction}
                    onClosePaymentModal={onClosePaymentModal}
                    onCancelOrder={onCancelOrder}
                />
            )}
        </>
    );

    const itemUpdatedModal = (
        <>
            {showItemUpdatedModal && <ItemAddedUpdatedModal isOpen={showItemUpdatedModal} onClose={onCloseItemUpdatedModal} isProductUpdate={true} />}
        </>
    );

    const modalsAndSpinners = (
        <>
            {/* <FullScreenSpinner show={loading} text={loadingMessage} /> */}

            {upSellCategoryModal()}
            {upSellProductModal()}
            {productModal()}
            {editProductModal()}
            {promotionCodeModal()}
            {paymentModal}
            {itemUpdatedModal}
        </>
    );

    const cartEmptyDisplay = (
        <>
            <div className="cart-empty">
                <div className="icon mb-3">
                    <ShoppingBasketIcon height={"72px"}></ShoppingBasketIcon>
                </div>
                <div className="h1 center mb-3">Empty cart</div>
                <div className="h3 center mb-6">Show some love and start ordering!</div>
                <Button
                    onClick={() => {
                        history.push(restaurantPath + "/" + restaurant!.id);
                    }}
                >
                    Back To Menu
                </Button>
            </div>
        </>
    );

    const onOrderMore = () => {
        history.push(`/restaurant/${restaurant.id}`);
    };

    const title = (
        <div className="title mb-6">
            <CachedImage className="image mr-2" url={`${getPublicCloudFrontDomainName()}/images/shopping-bag-icon.png`} alt="shopping-bag-icon" />
            <div className="h1">Your Order</div>
        </div>
    );

    const restaurantOrderType = (
        <div className="checkout-order-type mb-2">
            <div className="h3">Order Type: {orderType}</div>
            <Link onClick={onUpdateOrderType}>Change</Link>
        </div>
    );

    const promotionInformation = (
        <>
            {promotion && (
                <div className="checkout-promotion-information mb-2 pt-3 pr-3 pb-4 pl-3">
                    <div>
                        <div className="checkout-promotion-information-heading h3 mb-1">
                            <div>Promotion Applied!</div>
                            <div>-${convertCentsToDollars(promotion.discountedAmount)}</div>
                        </div>
                        {promotion.promotion.type !== EPromotionType.ENTIREORDER ? (
                            <div>
                                {promotion.promotion.name}:{" "}
                                {Object.values(promotion.matchingProducts).map((p, index) => (
                                    <>
                                        {index !== 0 && ", "}
                                        {p.name}
                                    </>
                                ))}
                            </div>
                        ) : (
                            <div>Entire Order</div>
                        )}
                    </div>
                </div>
            )}
        </>
    );

    const restaurantTableNumber = (
        <div className="checkout-table-number">
            <div className="h3">Table Number: {tableNumber}</div>
            <Link onClick={onUpdateTableNumber}>Change</Link>
        </div>
    );

    const orderSummary = (
        <OrderSummary
            onNotesChange={onNotesChange}
            onEditProduct={onEditProduct}
            onUpdateProductQuantity={onUpdateProductQuantity}
            onRemoveProduct={onRemoveProduct}
        />
    );

    const restaurantNotes = (
        <>
            <div className="h2 mb-3">Special Instructions</div>
            <TextArea placeholder={"Leave a note for the restaurant"} value={notes} onChange={onNotesChange} />
        </>
    );

    const order = (
        <>
            <div className="mt-10"></div>
            {title}
            {restaurantOrderType}
            {promotionInformation}
            {tableNumber && <div className="mb-4">{restaurantTableNumber}</div>}
            <div className="separator-6"></div>
            {orderSummary}
            {restaurantNotes}
        </>
    );

    const checkoutFooter = (
        <div>
            {promotion && (
                <div className="h3 text-center mb-2">
                    {`Discount${promotion.promotion.code ? ` (${promotion.promotion.code})` : ""}: -$${convertCentsToDollars(
                        promotion.discountedAmount
                    )}`}{" "}
                    {userAppliedPromotionCode && <Link onClick={removeUserAppliedPromotion}>Remove</Link>}
                </div>
            )}
            <div className="h1 text-center mb-4">Total: ${convertCentsToDollars(subTotal)}</div>
            <div className="mb-4">
                <div className="checkout-buttons-container">
                    <Button onClick={onOrderMore} className="button large mr-3 order-more-button">
                        Order More
                    </Button>
                    <Button onClick={onClickOrderButton} className="button large complete-order-button">
                        Complete Order
                    </Button>
                </div>
                {register.enablePayLater && (
                    <div className="pay-later-link mt-4">
                        <Link onClick={onClickPayLater}>Pay cash at counter...</Link>
                    </div>
                )}
                <div className="pay-later-link mt-4">
                    <Link onClick={onClickApplyPromotionCode}>Apply promo code</Link>
                </div>
            </div>
            <Button className="cancel-button" onClick={onCancelOrder}>
                Cancel Order
            </Button>
        </div>
    );

    return (
        <>
            <PageWrapper>
                <div className="checkout">
                    <div className="order-wrapper">
                        <div className="order">
                            {(!products || products.length == 0) && cartEmptyDisplay}
                            {products && products.length > 0 && order}
                        </div>
                    </div>
                    {products && products.length > 0 && <div className="footer">{checkoutFooter}</div>}
                </div>
                {modalsAndSpinners}
            </PageWrapper>
        </>
    );
};
