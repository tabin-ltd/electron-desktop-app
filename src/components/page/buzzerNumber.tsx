import { useState } from "react";
import { useNavigate } from "react-router";
import { checkoutPath } from "../main";
import { useCart } from "../../context/cart-context";
import { PageWrapper } from "../../tabin/components/pageWrapper";
import { Button } from "../../tabin/components/button";
import { Input } from "../../tabin/components/input";
import { useRestaurant } from "../../context/restaurant-context";

import "./buzzerNumber.scss";

export default () => {
    const navigate = useNavigate();
    const { buzzerNumber, setBuzzerNumber } = useCart();
    const [buzzer, setBuzzer] = useState(buzzerNumber);
    const { restaurant } = useRestaurant();

    if (restaurant == null) throw "Restaurant is invalid!";

    const onNext = () => {
        if (buzzerNumber) {
            setBuzzerNumber(buzzer);
            navigate(`${checkoutPath}`);
        } else {
            setBuzzerNumber(buzzer);
            navigate(`${checkoutPath}/true`);
        }
    };

    const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBuzzer(e.target.value);
    };

    return (
        <>
            <PageWrapper>
                <div className="buzzer-number">
                    <div className="h2 mb-12">Enter your buzzer number (click next if you are unsure)</div>
                    <div className="mb-12" style={{ width: "300px" }}>
                        <div className="h3 mb-2">Buzzer Number</div>
                        <Input type="number" autoFocus={true} onChange={onChange} value={buzzer ?? ""} />
                    </div>
                    <Button onClick={onNext}>Next</Button>
                </div>
            </PageWrapper>
        </>
    );
};
