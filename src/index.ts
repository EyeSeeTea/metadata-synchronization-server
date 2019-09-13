import express from "express";
import axios from "axios";
import btoa from "btoa";
import fs from "fs";
import path from "path";
import { init } from "d2";
import { configure, getLogger } from "log4js";
import * as yargs from "yargs";
import "dotenv/config";

import indexRouter from "./routes";
import Scheduler from "./logic/scheduler";
import Instance from "./models/instance";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize express
app.use("/", indexRouter);
app.listen(PORT);

// Workaround: Hide DEBUG logs from appearing in console
console.debug = (): void => {};

configure({
    appenders: {
        out: { type: "stdout" },
        file: { type: "file", filename: "debug.log" },
    },
    categories: { default: { appenders: ["file", "out"], level: "debug" } },
});

// Root folder on "yarn start" is ./src, ask path to go back one level
const rootFolder = process.env.NODE_ENV === "development" ? ".." : "";
const { config } = yargs.options({
    config: {
        type: "string",
        alias: "c",
        describe: "Configuration file",
        default: path.join(__dirname, rootFolder, "app-config.json"),
    },
}).argv;

const start = async (): Promise<void> => {
    const appConfig = fs.existsSync(config) ? JSON.parse(fs.readFileSync(config, "utf8")) : null;
    if (!appConfig) throw new Error("Config file not found");

    const { encryptionKey, apiUrl: baseUrl, username, password } = appConfig;

    const welcomeMessage = `Script initalized on ${baseUrl} with user ${username}`;
    getLogger("main").info("-".repeat(welcomeMessage.length));
    getLogger("main").info(welcomeMessage);

    // Login to the attached instance with basic auth
    const authorization = `Basic ${btoa(username + ":" + password)}`;
    const d2 = await init({ baseUrl, headers: { authorization } });
    axios.defaults.headers.common["Authorization"] = authorization;

    Instance.setEncryptionKey(encryptionKey);
    new Scheduler(d2).initialize();
};

start().catch(console.error);

export default app;
