import axios from "axios";
import { useEffect, createContext, useContext } from "react";
import { IGET_RESTAURANT_ORDER_FRAGMENT } from "../graphql/customFragments";
import { useGetRestaurantOrdersByBetweenPlacedAtLazyQuery } from "../hooks/useGetRestaurantOrdersByBetweenPlacedAtLazyQuery";
import { IPrintReceiptDataOutput, IOrderReceipt, IPrintSalesDataInput, IOrderLabel } from "../model/model";
import { toast } from "../tabin/components/toast";
import { convertProductTypesForPrint, filterPrintProducts, toLocalISOString } from "../util/util";
import { useErrorLogging } from "./errorLogging-context";
import { useRegister } from "./register-context";
import { useRestaurant } from "./restaurant-context";

let electron: any;
let ipcRenderer: any;
try {
    electron = window.require("electron");
    ipcRenderer = electron.ipcRenderer;
} catch (e) {}

type ContextProps = {
    printReceipt: (payload: IOrderReceipt) => Promise<any>;
    printLabel: (payload: IOrderLabel) => Promise<any>;
    printSalesData: (printSalesDataInput: IPrintSalesDataInput) => Promise<any>;
};

const ReceiptPrinterContext = createContext<ContextProps>({
    printReceipt: (payload: IOrderReceipt) => {
        return new Promise(() => {});
    },
    printLabel: (payload: IOrderLabel) => {
        return new Promise(() => {});
    },
    printSalesData: (printSalesDataInput: IPrintSalesDataInput) => {
        return new Promise(() => {});
    },
});

const ReceiptPrinterProvider = (props: { children: React.ReactNode }) => {
    const { restaurant } = useRestaurant();
    const { register } = useRegister();
    const { logError } = useErrorLogging();

    const { getRestaurantOrdersByBetweenPlacedAt } = useGetRestaurantOrdersByBetweenPlacedAtLazyQuery(); //Skip the first iteration. Get new orders from refetch.

    const fetchOrdersLoopTime = 15 * 1000; //15 seconds
    const retryPrintLoopTime = 20 * 1000; //20 seconds

    useEffect(() => {
        if (!restaurant) return;
        if (!register) return;

        let matchingPrinter = false;

        register.printers.items.forEach((printer) => {
            if (printer.printAllOrderReceipts || printer.printOnlineOrderReceipts) {
                matchingPrinter = true;
            }
        });

        if (!matchingPrinter) return;

        const ordersFetchTimer = setInterval(async () => {
            try {
                const ordersLastFetched = localStorage.getItem("ordersLastFetched");
                const now = toLocalISOString(new Date());

                if (!ordersLastFetched) {
                    localStorage.setItem("ordersLastFetched", now);
                    return;
                }

                const res = await getRestaurantOrdersByBetweenPlacedAt({
                    variables: {
                        orderRestaurantId: restaurant ? restaurant.id : "",
                        placedAtStartDate: ordersLastFetched,
                        placedAtEndDate: now,
                    },
                });

                const orders: IGET_RESTAURANT_ORDER_FRAGMENT[] = res.data.getOrdersByRestaurantByPlacedAt.items;

                await printNewOrderReceipts(orders);

                localStorage.setItem("ordersLastFetched", now);
            } catch (e) {
                console.error("Error", e);
                await logError("Error polling for new orders", JSON.stringify({ error: e, restaurant: restaurant }));
            }
        }, fetchOrdersLoopTime);

        return () => clearInterval(ordersFetchTimer);
    }, [restaurant, register]);

    useEffect(() => {
        if (!restaurant) return;
        if (!register) return;

        const retryFailedPrintQueueTimer = setInterval(async () => {
            try {
                const storedFiledPrintQueue = localStorage.getItem("failedPrintQueue");

                if (!storedFiledPrintQueue) return;

                const failedPrintQueue = JSON.parse(storedFiledPrintQueue) as IPrintReceiptDataOutput[];

                if (failedPrintQueue.length > 3) {
                    //Send notification for monitoring if it passes threshold
                    await logError("Failed receipt prints passed threshold", JSON.stringify({ failedPrintQueue: failedPrintQueue }));
                }

                for (var i = 0; i < failedPrintQueue.length; i++) {
                    const failedPrint = failedPrintQueue[i];

                    await printReceipt(failedPrint.order, true);
                }
            } catch (e) {
                await logError(
                    "Error reprinting failed orders",
                    JSON.stringify({ error: e, failedPrintQueue: localStorage.getItem("failedPrintQueue") })
                );
            }
        }, retryPrintLoopTime);

        return () => clearInterval(retryFailedPrintQueueTimer);
    }, [restaurant, register]);

    const printReceipt = async (order: IOrderReceipt, isRetry?: boolean) => {
        if (ipcRenderer) {
            try {
                const result: IPrintReceiptDataOutput = await ipcRenderer.invoke("RECEIPT_PRINTER_DATA", order);

                console.log("result", result);

                if (result.error && isRetry) {
                    //If retry dont readd same order into failedPrintQueue
                    return;
                } else if (result.error) {
                    toast.error("There was an error printing your order");
                    storeFailedPrint(result);
                } else if (isRetry) {
                    //We are retrying and the retry was successful, remove order from failedPrintQueue
                    removeSuccessPrintFromFailedPrintQueue(result);
                }
            } catch (e) {
                console.error(e);
                toast.error("There was an error printing your order");
                await logError("There was an error printing your order", JSON.stringify({ error: e, order: order }));
            }
        }
    };

    const makeResultInquiryData = (requestId, responseId, timeout) => {
        return '{"RequestID":' + requestId + ',"ResponseID":"' + responseId + '","Timeout":' + timeout + "}";
    };

    const checkResult = async (serverURL, requestId, responseId) => {
        const requestURL = serverURL + "/checkStatus";
        const inquiryData = makeResultInquiryData(requestId, responseId, 30);

        try {
            const response = await axios.post(requestURL, inquiryData);

            if (response.request.readyState === 4 && response.status === 200) {
                const res = response.data;

                if (res.Result === "ready" || res.Result === "progress") {
                    await checkResult(serverURL, res.RequestID, res.ResponseID);
                } else if (res.Result === "error") {
                    throw "Error";
                } else {
                    //Label has completed printing
                    console.log(res.ResponseID + ":" + res.Result);
                }
            } else if (response.request.readyState === 4 && response.status === 404) {
                throw "No printers";
            } else if (response.request.readyState === 4) {
                throw "Cannot connect to server";
            }
        } catch (e) {
            throw e;
        }
    };

    const requestPrint = async (serverAddress, printerName, payload) => {
        const serverURL = `http://${serverAddress}:18080/WebPrintSDK/${printerName}`;

        try {
            const response = await axios.post(serverURL, payload);

            if (response.request.readyState === 4 && response.status === 200) {
                const res = response.data;

                if (res.Result === "ready" || res.Result === "progress") {
                    await checkResult(serverURL, res.RequestID, res.ResponseID);
                } else if (res.Result === "error") {
                    throw "Error";
                } else if (res.Result === "duplicated") {
                    throw "Duplicated receipt";
                } else {
                    throw "Undefined error";
                }
            } else if (response.request.readyState === 4 && response.status === 404) {
                throw "No printers";
            } else if (response.request.readyState === 4) {
                throw "Cannot connect to server";
            }
        } catch (e) {
            throw e;
        }
    };

    const printLabel = async (order: IOrderLabel) => {
        try {
            let productCounter = 0;
            let totalProductCount = 0;

            order.products.forEach((product) => {
                totalProductCount += product.quantity;
            });

            for (var i = 0; i < order.products.length; i++) {
                const product = order.products[i];

                for (var qty = 0; qty < product.quantity; qty++) {
                    let funcCounter = 0;
                    productCounter++;

                    const emptyClearBuffer = `"func${funcCounter}":{"clearBuffer":[]}`;
                    funcCounter++;
                    const setPaperWidth = `"func${funcCounter}":{"setWidth":[300]}`;
                    funcCounter++;

                    const orderNumberString = `"func${funcCounter}":{"drawTrueTypeFont":["Order: ${order.number} (${productCounter}/${totalProductCount})",0,0,"Arial",20,0,false,false,false,true]}`;
                    funcCounter++;
                    const productString = `"func${funcCounter}":{"drawTrueTypeFont":["${product.name}",0,${
                        (funcCounter - 2) * 30 + 5
                    },"Arial",20,0,false,true,false,false]}`;
                    funcCounter++;

                    let modifierGroupString = "";
                    let mgString = "";

                    product.modifierGroups.forEach((modifierGroup, index) => {
                        mgString = `${modifierGroup.name}: `;

                        //Show only first 2 on first line
                        modifierGroup.modifiers.slice(0, 2).forEach((modifier, index2) => {
                            if (index2 !== 0) mgString += `, `;

                            mgString += modifier.name;
                        });

                        if (index !== 0) modifierGroupString += `,`;
                        modifierGroupString += `"func${funcCounter}":{"drawTrueTypeFont":["${mgString}",0,${
                            (funcCounter - 2) * 30 + 10
                        },"Arial",18,0,false,false,false,true]}`;
                        funcCounter++;

                        if (modifierGroup.modifiers.length > 2) {
                            mgString = ""; //Reset
                            //Show only first 2 on first line
                            modifierGroup.modifiers.slice(2).forEach((modifier, index2) => {
                                if (index2 !== 0) mgString += `, `;

                                mgString += modifier.name;
                            });

                            if (index !== 0) modifierGroupString += `,`;
                            modifierGroupString += `"func${funcCounter}":{"drawTrueTypeFont":["${mgString}",0,${
                                (funcCounter - 2) * 30 + 10
                            },"Arial",18,0,false,false,false,true]}`;
                            funcCounter++;
                        }
                    });

                    const timestampString = `"func${funcCounter}":{"drawTrueTypeFont":["${order.placedAt}",0,200,"Arial",16,0,false,false,false,true]}`;
                    funcCounter++;
                    const emptyPrintBuffer = `"func${funcCounter}":{"printBuffer":[]}`;
                    funcCounter++;
                    const payload = `{"id":1,"functions":{${emptyClearBuffer},${setPaperWidth},${orderNumberString},${productString},${modifierGroupString},${timestampString},${emptyPrintBuffer}}}`;

                    await requestPrint(order.printerAddress, order.printerName, payload);
                }
            }
        } catch (e) {
            console.error(e);
            toast.error("There was an error printing your order");
            await logError("There was an error printing your order", JSON.stringify({ error: e, order: order }));
        }
    };

    const printSalesData = async (printSalesDataInput: IPrintSalesDataInput) => {
        if (ipcRenderer) {
            try {
                const result: IPrintReceiptDataOutput = await ipcRenderer.invoke("RECEIPT_SALES_DATA", printSalesDataInput);

                console.log("result", result);

                if (result.error) toast.error("There was an error printing your report");
            } catch (e) {
                console.error(e);
                toast.error("There was an error printing your report");
                await logError("There was an error printing your report", JSON.stringify({ error: e, printSalesDataInput: printSalesDataInput }));
            }
        }
    };

    const storeFailedPrint = (failedPrintOrder: IPrintReceiptDataOutput) => {
        const currentFailedPrintQueue = localStorage.getItem("failedPrintQueue");
        const currentFailedPrintQueueOrders: IPrintReceiptDataOutput[] = currentFailedPrintQueue ? JSON.parse(currentFailedPrintQueue) : [];
        const newFailedPrintQueueOrders: IPrintReceiptDataOutput[] = [
            ...currentFailedPrintQueueOrders,
            {
                error: failedPrintOrder.error && failedPrintOrder.error.message ? failedPrintOrder.error.message : "",
                order: failedPrintOrder.order,
            },
        ];

        localStorage.setItem("failedPrintQueue", JSON.stringify(newFailedPrintQueueOrders));
    };

    const removeSuccessPrintFromFailedPrintQueue = (successPrintOrder: IPrintReceiptDataOutput) => {
        const storedFiledPrintQueue = localStorage.getItem("failedPrintQueue");

        if (!storedFiledPrintQueue) return;

        const failedPrintQueue = JSON.parse(storedFiledPrintQueue) as IPrintReceiptDataOutput[];

        const updatedFailedPrintQueue = failedPrintQueue.filter((o) => o.order.orderId != successPrintOrder.order.orderId);

        localStorage.setItem("failedPrintQueue", JSON.stringify(updatedFailedPrintQueue));
    };

    const printNewOrderReceipts = async (orders: IGET_RESTAURANT_ORDER_FRAGMENT[]) => {
        if (!restaurant) return;
        if (!register || register.printers.items.length == 0) return;

        for (var i = 0; i < register.printers.items.length; i++) {
            const printer = register.printers.items[i];

            if (!printer.printOnlineOrderReceipts && !printer.printAllOrderReceipts) return;

            for (var j = 0; j < orders.length; j++) {
                const order = orders[j];

                //If new order placed is from the current register do not print
                if (register.id === order.registerId) return;

                //If print online orders is selected but current order is not online, return
                if (printer.printOnlineOrderReceipts && !order.onlineOrder) return;

                const productsToPrint = filterPrintProducts(order.products, printer);

                if (productsToPrint.length > 0) {
                    await printReceipt({
                        orderId: order.id,
                        printerType: printer.type,
                        printerAddress: printer.address,
                        customerPrinter: printer.customerPrinter,
                        kitchenPrinter: printer.kitchenPrinter,
                        eftposReceipt: order.eftposReceipt || null,
                        hideModifierGroupsForCustomer: false,
                        restaurant: {
                            name: restaurant.name,
                            address: `${restaurant.address.aptSuite || ""} ${restaurant.address.formattedAddress || ""}`,
                            gstNumber: restaurant.gstNumber,
                        },
                        customerInformation: order.customerInformation
                            ? {
                                  firstName: order.customerInformation.firstName,
                                  email: order.customerInformation.email,
                                  phoneNumber: order.customerInformation.phoneNumber,
                              }
                            : null,
                        notes: order.notes,
                        products: convertProductTypesForPrint(productsToPrint),
                        paymentAmounts: order.paymentAmounts,
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
            }
        }
    };

    return (
        <ReceiptPrinterContext.Provider
            value={{
                printReceipt: printReceipt,
                printLabel: printLabel,
                printSalesData: printSalesData,
            }}
            children={props.children}
        />
    );
};

const useReceiptPrinter = () => {
    const context = useContext(ReceiptPrinterContext);
    if (context === undefined) {
        throw new Error(`useReceiptPrinter must be used within a ReceiptPrinterProvider`);
    }
    return context;
};

export { ReceiptPrinterProvider, useReceiptPrinter };
