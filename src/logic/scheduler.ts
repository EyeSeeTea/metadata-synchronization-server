import _ from "lodash";
import cronstrue from "cronstrue";
import schedule from "node-schedule";

import { startSynchronization } from "./synchronization";
import { SynchronizationRule } from "../types/synchronization";
import { D2 } from "../types/d2";
import SyncRule from "../models/syncRule";

export default class Scheduler {
    private static d2: D2;

    private static synchronizationTask = async (syncRule: SynchronizationRule): Promise<void> => {
        const { id, name, builder, frequency } = syncRule;
        try {
            console.log(`Rule ${name}`, { status: "STARTING", frequency: cronstrue.toString(frequency || "") });
            for await (const { message, syncReport, done } of startSynchronization(Scheduler.d2, {
                ...builder,
                syncRule: id,
            })) {
                if (message) console.log(`Rule ${name}`, { status: "RUNNING", message });
                if (syncReport) await syncReport.save(Scheduler.d2);
                if (done && syncReport) console.log(`Rule ${name}`, { status: "FINISHED" });
            }
        } catch (error) {
            console.error(`Failed executing rule ${name}`, error);
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
        idsToCancel.forEach((id: string): void => {
            schedule.scheduledJobs[id].cancel();
            console.log(`Cancelled job ${id}`);
        });

        // Create or update enabled jobs
        jobs.forEach((syncRule: SynchronizationRule): void => {
            const { id, name, frequency } = syncRule;
            if (id && frequency) {
                if (schedule.scheduledJobs[id]) {
                    console.log(`Updating existing rule ${name} with frequency ${cronstrue.toString(frequency)} (${frequency})`);
                    schedule.rescheduleJob(id, frequency);
                } else {
                    console.log(`Scheduling rule ${name} with frequency ${cronstrue.toString(frequency)} (${frequency})`);
                    schedule.scheduleJob(
                        id,
                        frequency,
                        (): Promise<void> => Scheduler.synchronizationTask(syncRule)
                    );
                }
            }
        });
    };

    static initialize(d2: D2): void {
        Scheduler.d2 = d2;

        Scheduler.fetchTask();
        schedule.scheduleJob("__default__", "* * * * *", Scheduler.fetchTask);
    }
}
