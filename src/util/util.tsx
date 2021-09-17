import { format, getDay, isWithinInterval } from "date-fns";
import {
    EDiscountType,
    IGET_DASHBOARD_PROMOTION_DISCOUNT,
    IGET_DASHBOARD_PROMOTION_ITEMS,
    IGET_RESTAURANT_ITEM_AVAILABILITY_HOURS,
    IGET_RESTAURANT_ITEM_AVAILABILITY_TIMES,
    IGET_RESTAURANT_MODIFIER,
    IGET_RESTAURANT_PRODUCT,
    IGET_RESTAURANT_PROMOTION_AVAILABILITY,
    IGET_RESTAURANT_PROMOTION_AVAILABILITY_TIMES,
} from "../graphql/customQueries";
import { ICartItemQuantitiesById, ICartItemQuantitiesByIdValue, ICartProduct } from "../model/model";

export const isItemSoldOut = (soldOut?: boolean, soldOutDate?: string) => {
    if (soldOut || soldOutDate == format(new Date(), "yyyy-MM-dd")) {
        return true;
    }

    return false;
};

export const isPromotionAvailable = (availability?: IGET_RESTAURANT_PROMOTION_AVAILABILITY) => {
    if (!availability) return true;

    const dayTimes: IGET_RESTAURANT_PROMOTION_AVAILABILITY_TIMES[] = getPromotionDayData(availability);

    if (dayTimes.length == 0) return true;

    const currentDateTime = new Date();
    let isWithinTimeSlot = false;

    dayTimes.forEach((timeSlot) => {
        let startDateTime = new Date(
            currentDateTime.getFullYear(),
            currentDateTime.getMonth(),
            currentDateTime.getDate(),
            parseInt(timeSlot.startTime.split(":")[0]),
            parseInt(timeSlot.startTime.split(":")[1]),
            0,
            0
        );
        let endDateTime = new Date(
            currentDateTime.getFullYear(),
            currentDateTime.getMonth(),
            currentDateTime.getDate(),
            parseInt(timeSlot.endTime.split(":")[0]),
            parseInt(timeSlot.endTime.split(":")[1]),
            0,
            0
        );

        const isWithin = isWithinInterval(currentDateTime, { start: startDateTime, end: endDateTime });

        if (isWithin && !isWithinTimeSlot) {
            isWithinTimeSlot = true;
        }
    });

    return isWithinTimeSlot;
};

export const isItemAvailable = (availability?: IGET_RESTAURANT_ITEM_AVAILABILITY_HOURS) => {
    if (!availability) return true;

    const dayTimes: IGET_RESTAURANT_ITEM_AVAILABILITY_TIMES[] = getDayData(availability);

    if (dayTimes.length == 0) return true;

    const currentDateTime = new Date();
    let isWithinTimeSlot = false;

    dayTimes.forEach((timeSlot) => {
        let startDateTime = new Date(
            currentDateTime.getFullYear(),
            currentDateTime.getMonth(),
            currentDateTime.getDate(),
            parseInt(timeSlot.startTime.split(":")[0]),
            parseInt(timeSlot.startTime.split(":")[1]),
            0,
            0
        );
        let endDateTime = new Date(
            currentDateTime.getFullYear(),
            currentDateTime.getMonth(),
            currentDateTime.getDate(),
            parseInt(timeSlot.endTime.split(":")[0]),
            parseInt(timeSlot.endTime.split(":")[1]),
            0,
            0
        );

        const isWithin = isWithinInterval(currentDateTime, { start: startDateTime, end: endDateTime });

        if (isWithin && !isWithinTimeSlot) {
            isWithinTimeSlot = true;
        }
    });

    return isWithinTimeSlot;
};

export const getProductQuantityAvailable = (
    menuProductItem: {
        id: string;
        totalQuantityAvailable: number;
    },
    cartProducts: ICartItemQuantitiesById
) => {
    let quantityAvailable = menuProductItem.totalQuantityAvailable;

    if (cartProducts[menuProductItem.id] != undefined) {
        quantityAvailable -= cartProducts[menuProductItem.id].quantity;
    }

    return quantityAvailable;
};

export const isProductQuantityAvailable = (
    menuProductItem: {
        id: string;
        totalQuantityAvailable?: number;
    },
    cartProducts: ICartItemQuantitiesById
) => {
    if (!menuProductItem.totalQuantityAvailable) return true;

    const productQuantityAvailable = getProductQuantityAvailable(
        { id: menuProductItem.id, totalQuantityAvailable: menuProductItem.totalQuantityAvailable },
        cartProducts
    );

    return productQuantityAvailable > 0;
};

export const getModifierQuantityAvailable = (
    menuModifierItem: {
        id: string;
        totalQuantityAvailable: number;
    },
    cartModifiers: ICartItemQuantitiesById
) => {
    let quantityAvailable = menuModifierItem.totalQuantityAvailable;

    if (cartModifiers[menuModifierItem.id] != undefined) {
        quantityAvailable -= cartModifiers[menuModifierItem.id].quantity;
    }

    return quantityAvailable;
};

export const isModifierQuantityAvailable = (
    menuModifierItem: {
        id: string;
        totalQuantityAvailable?: number;
    },
    cartModifiers: ICartItemQuantitiesById
) => {
    if (!menuModifierItem.totalQuantityAvailable) return true;

    const modifierQuantityAvailable = getModifierQuantityAvailable(
        { id: menuModifierItem.id, totalQuantityAvailable: menuModifierItem.totalQuantityAvailable },
        cartModifiers
    );

    return modifierQuantityAvailable > 0;
};

export const getQuantityRemainingText = (quantityRemaining: number) => {
    if (quantityRemaining == 1) {
        return "Last one!";
    } else {
        return `${quantityRemaining} left!`;
    }
};

const getPromotionDayData = (availability: IGET_RESTAURANT_PROMOTION_AVAILABILITY) => {
    const day: number = getDay(new Date());

    switch (day) {
        case 1:
            return availability.monday;
        case 2:
            return availability.tuesday;
        case 3:
            return availability.wednesday;
        case 4:
            return availability.thursday;
        case 5:
            return availability.friday;
        case 6:
            return availability.saturday;
        case 0: //0 is sunday in date-fns
            return availability.sunday;
        default:
            return [];
    }
};

const getDayData = (availability: IGET_RESTAURANT_ITEM_AVAILABILITY_HOURS) => {
    const day: number = getDay(new Date());

    switch (day) {
        case 1:
            return availability.monday;
        case 2:
            return availability.tuesday;
        case 3:
            return availability.wednesday;
        case 4:
            return availability.thursday;
        case 5:
            return availability.friday;
        case 6:
            return availability.saturday;
        case 0: //0 is sunday in date-fns
            return availability.sunday;
        default:
            return [];
    }
};

export const toLocalISOString = (date: Date) => {
    const tzo = -date.getTimezoneOffset();

    const pad = (num: number) => {
        var norm = Math.floor(Math.abs(num));
        return (norm < 10 ? "0" : "") + norm;
    };

    return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        "T" +
        pad(date.getHours()) +
        ":" +
        pad(date.getMinutes()) +
        ":" +
        pad(date.getSeconds()) +
        "." +
        pad(date.getMilliseconds())
    );
};

export const convertDollarsToCents = (price: number) => (price * 100).toFixed(0);

export const convertCentsToDollars = (price: number) => (price / 100).toFixed(2);

// https://stackoverflow.com/questions/149055/how-to-format-numbers-as-currency-string
export const currencyFormatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
});

export const toDataURL = (url, callback) => {
    const xhr = new XMLHttpRequest();

    xhr.onload = () => {
        const reader = new FileReader();

        reader.onloadend = () => {
            callback(reader.result);
        };

        reader.readAsDataURL(xhr.response);
    };

    xhr.open("GET", url);
    xhr.responseType = "blob";
    xhr.send();
};

export const getMatchingPromotionProducts = (
    cartCategoryQuantitiesById: ICartItemQuantitiesById,
    cartProductQuantitiesById: ICartItemQuantitiesById,
    promotionItems: IGET_DASHBOARD_PROMOTION_ITEMS[],
    applyToCheapest: boolean = false
) => {
    //For promotions with multiple item groups, it would become a && condition. For example, if first group is category: Vege Pizza (min quantity = 2).
    //And second group is category: Sides (min quantity = 1.
    //Then the user would need to select at least 2 Vege Pizza AND a side to get the discount

    let matchingProducts: ICartItemQuantitiesById = {};
    let matchingCondition = true;

    promotionItems.forEach((item) => {
        if (!matchingCondition) return;

        const matchingProductsTemp: ICartItemQuantitiesByIdValue[] = [];
        let quantityCounted = 0;

        item.categories.items.forEach((c) => {
            if (cartCategoryQuantitiesById[c.id]) {
                quantityCounted += cartCategoryQuantitiesById[c.id].quantity;

                Object.values(cartProductQuantitiesById).forEach((p) => {
                    if (p.categoryId == cartCategoryQuantitiesById[c.id].id) {
                        matchingProductsTemp.push(p);
                    }
                });
            }
        });

        item.products.items.forEach((p) => {
            if (cartProductQuantitiesById[p.id]) {
                quantityCounted += cartProductQuantitiesById[p.id].quantity;

                matchingProductsTemp.push(cartProductQuantitiesById[p.id]);
            }
        });

        if (quantityCounted < item.minQuantity) {
            //Didn't match the condition
            matchingCondition = false;
        } else {
            //Sort by price and get the lowest item.minQuantity
            const matchingProductsTempCpy: ICartItemQuantitiesByIdValue[] = [...matchingProductsTemp];

            const matchingProductsTempCpySorted = matchingProductsTempCpy.sort((a, b) => {
                if (applyToCheapest) {
                    return a.price > b.price ? 1 : -1;
                } else {
                    //reverse sort: largest to smallest
                    return a.price > b.price ? -1 : 1;
                }
            });

            let counter = item.minQuantity;

            matchingProductsTempCpySorted.forEach((p) => {
                if (counter == 0) return;

                const quantity = p.quantity;

                if (counter > quantity) {
                    matchingProducts[p.id] = p;
                    counter -= quantity;
                } else {
                    matchingProducts[p.id] = { ...p, quantity: counter };
                    counter = 0;
                }
            });
        }
    });

    return matchingCondition ? matchingProducts : null;
};

export const getMaxDiscountedAmount = (
    cartCategoryQuantitiesById: ICartItemQuantitiesById,
    cartProductQuantitiesById: ICartItemQuantitiesById,
    discounts: IGET_DASHBOARD_PROMOTION_DISCOUNT[],
    matchingProducts?: ICartItemQuantitiesById,
    total?: number
) => {
    let maxDiscountedAmount = 0;
    let totalDiscountableAmount = 0;

    if (total) {
        totalDiscountableAmount = total;
    } else {
        if (!matchingProducts) return 0;

        Object.values(matchingProducts).forEach((p) => {
            totalDiscountableAmount += p.price * p.quantity;
        });
    }

    discounts.forEach((discount) => {
        let discountedAmount = 0;

        let matchingDiscountProducts: ICartItemQuantitiesById | null = null;

        //For related items promotion
        if (discount.items) {
            //Reset discountable amount because we want to discount the matchingDiscountProducts not the original matchingProducts
            totalDiscountableAmount = 0;
            matchingDiscountProducts = getMatchingPromotionProducts(cartCategoryQuantitiesById, cartProductQuantitiesById, discount.items.items);

            if (!matchingDiscountProducts) return 0;

            Object.values(matchingDiscountProducts).forEach((p) => {
                totalDiscountableAmount += p.price * p.quantity;
            });
        }

        switch (discount.type) {
            case EDiscountType.FIXED:
                discountedAmount = discount.amount;
                break;
            case EDiscountType.PERCENTAGE:
                discountedAmount = (totalDiscountableAmount * discount.amount) / 100;
                break;
            case EDiscountType.SETPRICE:
                discountedAmount = totalDiscountableAmount - discount.amount;
                break;
            default:
                break;
        }

        if (maxDiscountedAmount < discountedAmount) {
            maxDiscountedAmount = discountedAmount;
        }
    });

    return maxDiscountedAmount;
};
