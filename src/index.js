import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import logger from "morgan";
import { createEngine } from "express-react-views";

import indexRouter from "./routes/index";
import "dotenv/config";

const app = express();

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Allow server-side react rendering
app.set("views", __dirname + "/views");
app.set("view engine", "jsx");
app.engine("jsx", createEngine());

// Initialize router
app.use("/", indexRouter);

app.listen(process.env.PORT);
console.log(`Server started on ${process.env.PORT}`);

export default app;
