import React from "react";

const IndexView = ({ title }) => {
    return (
        <html>
            <head>
                <title>{title}</title>
            </head>
            <body>{`Hello world ${title}!`}</body>
        </html>
    );
};

export default IndexView;
