import React from "react";
import { NormalFont } from "./fonts";
import { InputV2Style } from "./inputv2";

const styles = require("./textAreav2.module.css");

export const TextAreaV2 = (props: {
    onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
    onFocus?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
    onBlur?: (event: React.FocusEvent<HTMLTextAreaElement>) => void;
    rows?: number;
    value?: string | number | string[];
    name?: string;
    error?: boolean;
    placeholder?: string;
    disabled?: boolean;
    style?: React.CSSProperties;
}) => {
    // default style
    let defaultStyle = InputV2Style;
    defaultStyle = {
        ...defaultStyle,
        ...{ resize: "none" },
    };

    // disabled style && error style
    if (props.disabled) {
        defaultStyle = {
            ...defaultStyle,
            ...{ backgroundColor: "rgb(240, 240, 240)" },
        };
    } else if (props.error) {
        defaultStyle = {
            ...defaultStyle,
            ...{
                border: "1px solid var(--error-color)",
                backgroundColor: "hsl(var(--error-hue), var(--error-saturation), 98%)",
            },
        };
    }

    // props style
    let style = defaultStyle;
    if (props.style) {
        style = { ...style, ...props.style };
    }

    return (
        <NormalFont>
            <textarea
                className={styles.textarea} // for placeholder
                rows={props.rows ? props.rows : 1}
                placeholder={props.placeholder}
                name={props.name}
                onChange={props.onChange}
                onBlur={props.onBlur}
                onFocus={props.onFocus}
                value={props.value}
                disabled={props.disabled}
                style={style}
            ></textarea>
        </NormalFont>
    );
};
