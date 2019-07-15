import _ from "lodash";
import axios, { AxiosBasicCredentials } from "axios";
import schedule from "node-schedule";
import "dotenv/config";
import { SynchronizationRule } from "../types/synchronization";

export default class Scheduler {
    private static baseUrl: string;
    private static auth: AxiosBasicCredentials;

    private static synchronizationTask = async (syncRule: SynchronizationRule): Promise<void> => {
        const { name, builder } = syncRule;
        console.log(`Executing rule ${name}: ${builder.metadataIds.join(", ")}`);
    };

    private static fetchTask = async (): Promise<void> => {
        // TODO: We should use dataStore (refactor to not rely on browser/d2 pending)
        const rules = (await axios.get(
            `${Scheduler.baseUrl}/api/dataStore/metadata-synchronization/rules`,
            { auth: Scheduler.auth }
        )).data;

        const jobs = _.filter(rules, rule => rule.enabled === "true");
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
                    console.log(`Updating existing rule ${name} with frequency ${frequency}`);
                    schedule.rescheduleJob(id, frequency);
                } else {
                    console.log(`Scheduling rule ${name} with frequency ${frequency}`);
                    schedule.scheduleJob(
                        id,
                        frequency,
                        (): Promise<void> => Scheduler.synchronizationTask(syncRule)
                    );
                }
            }
        });
    };

    static initialize(baseUrl: string, auth: AxiosBasicCredentials): void {
        Scheduler.baseUrl = baseUrl;
        Scheduler.auth = auth;

        schedule.scheduleJob("__default__", "* * * * *", Scheduler.fetchTask);
    }
}
