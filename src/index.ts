import express from "express";
import axios from "axios";
import btoa from "btoa";
import fs from "fs";
import { init } from "d2";
import { configure } from "log4js";
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
    appenders: { file: { type: "file", filename: "debug.log" } },
    categories: { default: { appenders: ["file"], level: "debug" } },
});

const { c: configFile } = process.env.NODE_ENV !== "development" ? yargs.options({
    c: {
        type: "string",
        demandOption: true,
        alias: "config",
    },
}).argv : { c: "../app-config.json" };

const start = async (): Promise<void> => {
    let appConfig;
    if (fs.existsSync(configFile)) {
        appConfig = JSON.parse(fs.readFileSync(configFile, "utf8"));
    } else {
        throw new Error("Config file not found");
    }

    const { encryptionKey, apiUrl: baseUrl, username, password } = appConfig;

    console.log(`Script initalized on ${baseUrl} with user ${username}`);

    // Login to the attached instance with basic auth
    const authorization = `Basic ${btoa(username + ":" + password)}`;
    const d2 = await init({ baseUrl, headers: { authorization } });
    axios.defaults.headers.common["Authorization"] = authorization;

    Instance.setEncryptionKey(encryptionKey);
    new Scheduler(d2).initialize();
};

start().catch(console.error);

export default app;
