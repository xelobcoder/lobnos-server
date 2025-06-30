import { promisifyQuery } from "../../../hooks/helper";
import { q_sms_birthday_clients } from "./queries";
import { PrimeSmsServices } from "./smsClass";

export default class SMSPrimeEvents extends PrimeSmsServices {
     eventname: string
     private tenantId: number;
     scheduledDate: string | null;
     scheduledTime: string | null;
     constructor(tenantId:number,eventname: string, scheduledDate: string = null, scheduledTime: string = null) {
          super();
          this
          this.eventname = eventname;
          this.scheduledDate = scheduledDate;
          this.scheduledTime = scheduledTime;
     }

     async birthdayEvent() {
          const clients = await promisifyQuery(this.tenantId,q_sms_birthday_clients);
          console.log(clients)
     }
}
