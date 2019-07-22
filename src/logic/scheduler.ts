import _ from "lodash";
import cronstrue from "cronstrue";
import schedule from "node-schedule";
import { getLogger } from "log4js";

import { startSynchronization } from "./synchronization";
import { SynchronizationRule } from "../types/synchronization";
import { D2 } from "../types/d2";
import SyncRule from "../models/syncRule";

export default class Scheduler {
    private d2: D2;

    constructor(d2: D2) {
        this.d2 = d2;
    }

    private synchronizationTask = async (syncRule: SynchronizationRule): Promise<void> => {
        const { id, name, builder, frequency } = syncRule;
        const logger = getLogger(name);
        try {
            logger.debug(`Start with frequency: ${cronstrue.toString(frequency || "")}`);
            for await (const { message, syncReport, done } of startSynchronization(this.d2, {
                ...builder,
                syncRule: id,
            })) {
                if (message) logger.debug(message);
                if (syncReport) await syncReport.save(this.d2);
                if (done && syncReport) logger.debug("Finished");
            }
        } catch (error) {
            logger.debug(`Failed executing rule`, error);
        }
    };

    private fetchTask = async (): Promise<void> => {
        const { objects: rules } = await SyncRule.list(this.d2, {}, { paging: false });

        const jobs = _.filter(rules, rule => rule.enabled);
        const idsToCancel = _.difference(
            _.keys(schedule.scheduledJobs),
            ["__default__"],
            jobs.map(job => job.id)
        );

        // Cancel disabled jobs that were scheduled
        idsToCancel.forEach((id: string): boolean => schedule.scheduledJobs[id].cancel());

        // Create or update enabled jobs
        jobs.forEach((syncRule: SynchronizationRule): void => {
            const { id, frequency } = syncRule;

            if (id && frequency) {
                if (schedule.scheduledJobs[id]) schedule.rescheduleJob(id, frequency);
                else
                    schedule.scheduleJob(
                        id,
                        frequency,
                        (): Promise<void> => this.synchronizationTask(syncRule)
                    );
            }
        });
    };

    public initialize(): void {
        // Execute fetch task immediately
        this.fetchTask();

        // Schedule periodic fetch task every minute
        schedule.scheduleJob("__default__", "0 * * * * *", this.fetchTask);
    }
}
