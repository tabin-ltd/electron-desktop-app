import { GET_ORDERS_BY_RESTAURANT_BY_PLACEDAT } from "../graphql/customQueries";
import { useQuery } from "@apollo/client";
import { useEffect, useState } from "react";
import { IGET_RESTAURANT_ORDER_FRAGMENT } from "../graphql/customFragments";

export const useGetRestaurantOrdersByPlacedAt = (orderRestaurantId: string, placedAt: string) => {
    const [data, setSavedData] = useState<IGET_RESTAURANT_ORDER_FRAGMENT[] | null>(null);

    const { loading, error, data: _data } = useQuery(GET_ORDERS_BY_RESTAURANT_BY_PLACEDAT, {
        variables: {
            orderRestaurantId: orderRestaurantId,
            placedAt: placedAt,
        },
        fetchPolicy: "network-only",
    });

    // pass saved data down when refetching instead of null
    useEffect(() => {
        if (_data) {
            setSavedData(_data.getOrdersByRestaurantByPlacedAt.items);
        }
    }, [_data]);

    return {
        data,
        error,
        loading,
    };
};
