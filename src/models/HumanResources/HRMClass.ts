class HR {
     private employeeid: number;

     constructor(employeeid: number) {
          this.employeeid = employeeid;
     }

     get newEmployeeid(): number {
          return this.employeeid;
     }

     set newEmployeeid(employeeid: number) {
          this.employeeid = employeeid;
     }
}

export default HR;
