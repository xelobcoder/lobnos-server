const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()


const addNewDepartment = async function (request, response) {
 const { department, departmentManager, employeeid } = request.body;
 const newDepartment = async () => {
  const creation = await prisma.departments.create({
   data: {
    department,
    departmentManager,
    employeeid,
   }
  })
  return creation;
 }

 newDepartment()
  .then((data) => {
   response.send({
    statusCode: 200,
    status: 'success',
    message: 'Department added successfully',
    data
   })
  })
  .catch((error) => {
   console.log(error)
   response.send({
    statusCode: 500,
    status: 'error',
    message: 'Department not added',
    error
   })
  }
  )
}



const getDepartments = async function (request, response) {
 // limit by 50 and in desc order
 const departments = async () => {
  let dept = prisma.departments.findMany({
   take: 20,
    orderBy: {
      id: 'desc'
    }
  })
  return dept
 }

 departments()

  .then((data) => {
   response.send({
    statusCode: 200,
    status: 'success',
    message: 'Departments fetched successfully',
    data
   })
  }
  )
  .catch((error) => {
   console.log(error)
   response.send({
    statusCode: 500,
    status: 'error',
    message: 'Departments not fetched',
    error
   })
  }
  )
}



const updateDepartment = async function (request, response) {
 const { department, departmentManager, id, employeeid } = request.body;
 const updatedDepartment = async () => {
  const update = await prisma.departments.update({
   where: {
    id: parseInt(id)
   },
   data: {
    department,
    departmentManager,
    employeeid
   }
  })
  return update;
 }

 updatedDepartment()
  .then((data) => {
   response.send({
    statusCode: 200,
    status: 'success',
    message: 'Department updated successfully',
    data
   })
  }
  )
  .catch((error) => {
   console.log(error)
   response.send({
    statusCode: 500,
    status: 'error',
    message: 'Department not updated',
    error
   })
  }
  )

}


const deleteDepartment = async function (request, response) {
 const { id } = request.body;
 const deletedDepartment = async () => {
  const deletion = await prisma.departments.delete({
   where: {
    id: parseInt(id)
   }
  })
  return deletion;
 }

 deletedDepartment()
  .then((data) => {
   response.send({
    statusCode: 200,
    status: 'success',
    message: 'Department deleted successfully',
    data
   })
  }
  )
  .catch((error) => {
   console.log(error)
   response.send({
    statusCode: 500,
    status: 'error',
    message: 'Department not deleted',
    error
   })
  }
  )
}


const getSpecificDepartment = async function (request, response) {
 const { id } = request.params;
 const department = async () => {
  let dept = prisma.departments.findMany({
   where: {
    id: parseInt(id)
   }
  })

  return dept;
 }

 department()
  .then((data) => {
   response.send({
    statusCode: 200,
    status: 'success',
    message: 'Department retrieved successfully',
    department: data
   })
  })
  .catch((error) => {
   console.log(error)
   response.send({
    statusCode: 500,
    status: 'error',
    message: 'Department not retrieved',
    error
   })
  }
  )
}
module.exports = {
 addNewDepartment,
 getDepartments,
 deleteDepartment,
 updateDepartment,
 getSpecificDepartment
}