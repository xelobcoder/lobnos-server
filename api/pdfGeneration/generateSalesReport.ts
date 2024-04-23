type User = {
  id: number
  role: string
  employeeid: number
}

class SalesReportPdf {
  execTime: number
  private readonly defaultExecTime = 12

  constructor(execTime: number) {
    this.execTime = execTime
  }

  generateSalesReport(user: User) {
    console.log(user)
  }
}


const t2 = new SalesReportPdf(45).generateSalesReport({id: 1, role:"admin", employeeid: 45});

console.log(t2)