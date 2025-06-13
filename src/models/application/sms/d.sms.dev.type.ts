export type smsEventTypes = {
     eventname: string,
     scheduledDate: string | null,
     scheduldTime: string | null
}



export const EventNames: string[] = [
     "birthday",
     "resultready",
     "resultprocessing"
]