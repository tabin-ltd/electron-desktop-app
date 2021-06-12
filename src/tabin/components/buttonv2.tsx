import React from "react";
import { Spinner } from "./spinner";

export const ButtonV2 = (props: IProps) => {
    let defaultStyle: React.CSSProperties = {
        color: "white",
        // width: "100%",
        backgroundColor: "var(--primary-color)",
        display: "flex",
        justifyContent: "center",
        padding: "16px 24px",
        borderRadius: "3px",
        cursor: "pointer",
    };

    // disabled style && error style
    if (props.disabled) {
        defaultStyle = {
            ...defaultStyle,
            ...{
                cursor: "default",
                backgroundImage: "none",
                backgroundColor: "hsl(0,0%,70%)",
            },
        };
    }

    // props style
    let style = defaultStyle;
    if (props.style) {
        style = { ...style, ...props.style };
    }

    return (
        <button className={props.className} style={style} onClick={props.onClick} disabled={props.disabled}>
            {props.loading ? <Spinner /> : props.children}
        </button>
    );
};

export interface IProps {
    loading?: boolean;
    onClick?: () => void;
    disabled?: boolean;
    children: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
}
