// https://dev.to/sabinthedev/basic-crud-operations-in-prisma-507a
/* import { PrismaClient, Don } from '@prisma/client' */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const dons = await prisma.don.findMany()
  console.log(dons)


  /*  const newUser: Don = await prisma.don.create({
     data: {
       title: 'Sabin',
       multimedia: 'multimedia',
       description: 'Adams',
       category: 'lagunak'
     },
     //  select: {
     //   id: true,
     //   title: true,
     //   multimedia: true,
     //   description: true,
     //   category: true,
     //   createdAt: true,
     //   updatedAt: true
     // }
   })
   console.log("newUser", newUser) */

  /* const id = 1
  const don = await prisma.don.update({
    // select: {
    //  id: true
    // },
    where: {
      id
    },
    data: {
      title: "otro"
    }
  })

  console.log(`don ${id} updated`, don) */
  /* const id = 3
  const deleted = await prisma.don.delete({
    where: {
      id
    },
    // select: {
    //  email: true
    // }
  })

  console.log(`don ${id} deleted`, deleted) */
}

main()
  .catch(e => { throw e })
  .finally(async () => await prisma.$disconnect())

/* main()
  .then(async () => {
    await prisma.$disconnect()
  })

  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  }) */
// npx ts-node-esm api.ts