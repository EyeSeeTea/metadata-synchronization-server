import _ from "lodash";
import cronstrue from "cronstrue";
import schedule from "node-schedule";
import { getLogger } from "log4js";

import { startSynchronization } from "./synchronization";
import { SynchronizationRule } from "../types/synchronization";
import { D2 } from "../types/d2";
import SyncRule from "../models/syncRule";

export default class Scheduler {
    private static d2: D2;

    private static synchronizationTask = async (syncRule: SynchronizationRule): Promise<void> => {
        const { id, name, builder, frequency } = syncRule;
        const logger = getLogger(name);
        try {
            logger.debug(`Start with frequency: ${cronstrue.toString(frequency || "")}`);
            for await (const { message, syncReport, done } of startSynchronization(Scheduler.d2, {
                ...builder,
                syncRule: id,
            })) {
                if (message) logger.debug(message);
                if (syncReport) await syncReport.save(Scheduler.d2);
                if (done && syncReport) logger.debug("Finished");
            }
        } catch (error) {
            logger.debug(`Failed executing rule`, error);
        }
    };

    private static fetchTask = async (): Promise<void> => {
        const { objects: rules } = await SyncRule.list(Scheduler.d2, {}, { paging: false });

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
                        (): Promise<void> => Scheduler.synchronizationTask(syncRule)
                    );
            }
        });
    };

    static initialize(d2: D2): void {
        Scheduler.d2 = d2;

        Scheduler.fetchTask();
        schedule.scheduleJob("__default__", "* * * * *", Scheduler.fetchTask);
    }
}
