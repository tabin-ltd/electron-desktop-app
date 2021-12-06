import { FullScreenSpinner } from "../../tabin/components/fullScreenSpinner";
import { convertCentsToDollars } from "../../util/util";
import { PieGraph } from "./salesAnalytics/salesAnalyticsGraphs";
import { Table } from "../../tabin/components/table";
import { useSalesAnalytics } from "../../context/salesAnalytics-context";
import { SalesAnalyticsWrapper } from "./salesAnalytics/salesAnalyticsWrapper";
import { taxRate } from "../../model/util";
import { CachedImage } from "../../tabin/components/cachedImage";
import { getCloudFrontDomainName } from "../../private/aws-custom";

import "./salesAnalytics.scss";

export const SalesAnalyticsTopCategory = () => {
    const { startDate, endDate, salesAnalytics, error, loading } = useSalesAnalytics();
    const graphColor = getComputedStyle(document.documentElement).getPropertyValue("--primary-color");

    if (error) return <h1>Couldn't fetch orders. Try Refreshing</h1>;
    if (loading) return <FullScreenSpinner show={loading} text={"Loading report details..."} />;

    return (
        <>
            <SalesAnalyticsWrapper title="Sales By Category" showBackButton={true}>
                {!startDate || !endDate ? (
                    <div className="text-center">Please select a start and end date.</div>
                ) : salesAnalytics && salesAnalytics.totalSoldItems > 0 ? (
                    <div className="sales-by">
                        <div className="mb-6" style={{ width: "100%", height: "300px" }}>
                            <PieGraph data={salesAnalytics.categoryByGraphData} fill={graphColor} />
                        </div>
                        <div className="sales-table-wrapper">
                            <Table>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th className="text-left">Category</th>
                                        <th className="text-right">Quantity</th>
                                        <th className="text-right">Tax</th>
                                        <th className="text-right">Total</th>
                                        <th className="text-right">% Of Sale</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(salesAnalytics.mostSoldCategories)
                                        .sort((a, b) => b[1].totalAmount - a[1].totalAmount)
                                        .map(([categoryId, category]) => (
                                            <tr key={categoryId}>
                                                <td className="sales-analytics-table-image-cell">
                                                    {category.item.image && (
                                                        <CachedImage
                                                            url={`${getCloudFrontDomainName()}/protected/${category.item.image.identityPoolId}/${
                                                                category.item.image.key
                                                            }`}
                                                            className="sales-analytics-table-image"
                                                            alt="category-image"
                                                        />
                                                    )}
                                                </td>
                                                <td className="text-left">{category.item.name}</td>
                                                <td className="text-right">{category.totalQuantity}</td>
                                                <td className="text-right">{`$${convertCentsToDollars(category.totalAmount * (taxRate / 100))}`}</td>
                                                <td className="text-right">{`$${convertCentsToDollars(category.totalAmount)}`}</td>
                                                <td className="text-right">{`${((category.totalAmount * 100) / salesAnalytics.totalSubTotal).toFixed(
                                                    2
                                                )}%`}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="text-center">No orders were placed during this period. Please select another date range.</div>
                )}
            </SalesAnalyticsWrapper>
        </>
    );
};
