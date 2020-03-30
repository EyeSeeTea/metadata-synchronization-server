import axiosRetry from "axios-retry";
import btoa from "btoa";
import { init } from "d2";
import { D2ApiDefault, D2Api } from "d2-api";
import "dotenv/config";
import express from "express";
import fs from "fs";
import _ from "lodash";
import { configure, getLogger } from "log4js";
import path from "path";
import * as yargs from "yargs";
import Scheduler from "./logic/scheduler";
import { MigrationsRunner } from "./migrations";
import { getMigrationsForNode } from "./migrations/utils";
import Instance from "./models/instance";
import indexRouter from "./routes";

const app = express();
const PORT = process.env.PORT || 3000;
const development = process.env.NODE_ENV === "development";

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Initialize express
app.use("/", indexRouter);
app.listen(PORT);

// Workaround: Hide DEBUG logs from appearing in console
console.debug = _.noop;

configure({
    appenders: {
        out: { type: "stdout" },
        file: { type: "file", filename: "debug.log" },
    },
    categories: { default: { appenders: ["file", "out"], level: development ? "all" : "debug" } },
});

// Root folder on "yarn start" is ./src, ask path to go back one level
const rootFolder = development ? ".." : "";
const { config } = yargs
    .options({
        config: {
            type: "string",
            alias: "c",
            describe: "Configuration file",
            default: path.join(__dirname, rootFolder, "app-config.json"),
        },
    })
    .coerce("config", path => {
        if (fs.existsSync(path)) {
            return JSON.parse(fs.readFileSync(path, "utf8"));
        } else {
            throw new Error("Configuration file not found");
        }
    }).argv;

const checkMigrations = async (api: D2Api) => {
    axiosRetry(api.connection, { retries: 3 });
    const migrations = getMigrationsForNode();
    const debug = getLogger("migrations").debug;
    const runner = await MigrationsRunner.init({ api, debug, migrations });
    if (runner.hasPendingMigrations()) {
        getLogger("migrations").fatal("Scheduler is unable to continue due to database migrations");
        throw new Error("There are pending migrations to be applied to the data store");
    }
};

const start = async (): Promise<void> => {
    const { encryptionKey, baseUrl, username, password } = config;

    const authorization = `Basic ${btoa(username + ":" + password)}`;
    const api = new D2ApiDefault({ baseUrl, auth: { username, password } });
    const d2 = await init({ baseUrl: `${baseUrl}/api`, headers: { authorization } });
    await checkMigrations(api);

    const welcomeMessage = `Script initialized on ${baseUrl} with user ${username}`;
    getLogger("main").info("-".repeat(welcomeMessage.length));
    getLogger("main").info(welcomeMessage);

    Instance.setEncryptionKey(encryptionKey);
    new Scheduler(d2, api).initialize();
};

start().catch(console.error);

export default app;
