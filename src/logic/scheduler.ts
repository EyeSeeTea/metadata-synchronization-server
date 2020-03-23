import cronstrue from "cronstrue";
import { D2Api } from "d2-api";
import _ from "lodash";
import { getLogger } from "log4js";
import schedule from "node-schedule";
import SyncRule from "../models/syncRule";
import { D2 } from "../types/d2";
import { SynchronizationRule, SyncRuleType } from "../types/synchronization";
import { AggregatedSync } from "./sync/aggregated";
import { EventsSync } from "./sync/events";
import { SyncronizationClass } from "./sync/generic";
import { MetadataSync } from "./sync/metadata";
import { DeletedSync } from "./sync/deleted";

const config: Record<
    SyncRuleType,
    {
        SyncClass: SyncronizationClass;
    }
> = {
    metadata: {
        SyncClass: MetadataSync,
    },
    aggregated: {
        SyncClass: AggregatedSync,
    },
    events: {
        SyncClass: EventsSync,
    },
    deleted: {
        SyncClass: DeletedSync,
    },
};

export default class Scheduler {
    private d2: D2;
    private api: D2Api;

    constructor(d2: D2, api: D2Api) {
        this.d2 = d2;
        this.api = api;
    }

    private synchronizationTask = async (syncRule: SyncRule): Promise<void> => {
        const { name, type, frequency } = syncRule;
        const { SyncClass } = config[type];

        const logger = getLogger(name);
        try {
            logger.debug(`Start with frequency: ${cronstrue.toString(frequency || "")}`);
            const sync = new SyncClass(this.d2, this.api, syncRule.toBuilder());
            for await (const { message, syncReport, done } of sync.execute()) {
                if (message) logger.debug(message);
                if (syncReport) await syncReport.save(this.api);
                if (done && syncReport && syncReport.id)
                    logger.debug(`Finished. Report available at ${this.buildUrl(syncReport.id)}`);
                else if (done) logger.warn(`Finished with errors`);
            }
        } catch (error) {
            logger.error(`Failed executing rule`, error);
        }
    };

    private fetchTask = async (): Promise<void> => {
        const { objects: rules } = await SyncRule.list(this.api, {}, { paging: false });

        const jobs = _.filter(rules, rule => rule.enabled);
        const idsToCancel = _.difference(_.keys(schedule.scheduledJobs), ["__default__"]);

        // Cancel disabled jobs that were scheduled
        idsToCancel.forEach((id: string): boolean => schedule.scheduledJobs[id].cancel());

        // Create or update enabled jobs
        jobs.forEach((syncRule: SynchronizationRule): void => {
            const { id, frequency } = syncRule;

            if (id && frequency) {
                schedule.scheduleJob(
                    id,
                    frequency,
                    (): Promise<void> => this.synchronizationTask(SyncRule.build(syncRule))
                );
            }
        });
    };

    private buildUrl(id: string): string {
        return `${
            this.d2.Api.getApi().baseUrl
        }/apps/Metadata-Synchronization/index.html#/history/${id}`;
    }

    public initialize(): void {
        // Execute fetch task immediately
        this.fetchTask();

        // Schedule periodic fetch task every minute
        schedule.scheduleJob("__default__", "0 * * * * *", this.fetchTask);

        getLogger("main").info(`Loading synchronization rules from remote server`);
    }
}
