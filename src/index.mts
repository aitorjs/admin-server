import { Hono, Context } from 'hono'
import { env } from 'hono/adapter'
import { cors } from 'hono/cors'
import { BodyData } from 'hono/utils/body'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { PrismaClient, Don, User, Donusers, Category } from '@prisma/client'
import fs from 'fs'
import bcrypt from 'bcrypt'
import CredentialsProvider from "@auth/core/providers/credentials"
import { authHandler, initAuthConfig, verifyAuth, AuthConfig } from "@hono/auth-js"
import { PrismaAdapter } from '@auth/prisma-adapter'

import { getAuthUser } from '@hono/auth-js'
const prisma = new PrismaClient()
const app = new Hono()

const firstUserId = "4cb9fcbb-24e0-4869-8131-9f3171c64cb9"

const isAuth = async (c, admitRoles, userId = null) => {
  const status = true
  const { token } = await getAuthUser(c)
  const rol = token.roles.title
  if (admitRoles.includes("owner") && rol === "user") {
    const tokenUserid = token.id
    const urlUserid = userId ? userId : c.req.path.split("/").pop()
    console.log("userid", tokenUserid, urlUserid)
    if (urlUserid !== tokenUserid) {
      c.status(401)
      return false
    }
  } else if (!admitRoles.includes(rol)) {
    console.log('auth', token)
    c.status(401)
    return false
  }

  return status
}

app.use(
  '/*',
  cors({
    origin: ['http://localhost:5173'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    maxAge: 600,
    credentials: true,
  })
)

const generateRandomString = () => {
  return Math.floor(Math.random() * Date.now()).toString(36)
}

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

console.log('process.env', process.env)

/* auth */
// http://localhost:3000/api/auth/callback/github
// http://localhost:3000/api/auth/signin
// http://localhost:3000/api/auth/signout
// get csrf token: http://localhost:3000/api/auth/csrf

app.use("*", initAuthConfig(getAuthConfig))

app.use("/api/auth/*", authHandler())

app.use('/api/*', verifyAuth())

app.get('/api/protected', (c) => {
  const auth = c.get("authUser")
  return c.json(auth)
})

app.get('/login', async (c) => {
  let url = c.req.url
  url = url.split('?error')
  return c.redirect(`http://localhost:5173/login?error${url[1]}`)
})

app.get('/logout', async (c) => {
  return c.redirect(`http://localhost:5173`)
})

/* async function passwordToSalt(password) {
  const saltRounds = 10
  return await bcrypt.hash(password, saltRounds)
} */

async function getUserFromDb(email, password) {
  const user = await prisma.user.findFirst({
    where: {
      email
    }
  })

  if (!user) return null

  const isGoodPassword = await bcrypt.compare(password, user?.password)

  if (!isGoodPassword) return null

  const role = await prisma.role.findUnique(
    { where: { id: user.roles } }
  )

  if (user.avatar !== null) {
    const avatar = await prisma.multimedia.findUnique(
      { where: { id: user.avatar } }
    )
    user.avatar = avatar!.name
  }

  user.roles = {
    id: role!.id,
    title: role!.title
  }

  return user
}
function getAuthConfig(c: Context): AuthConfig {
  return {
    adapter: PrismaAdapter(prisma),
    cookies: {
      sessionToken: {
        name: "authjs.session-token",
        options: {
          // domain: "localhost",
          // path: "/",
          httpOnly: false,
          // sameSite: "lax",
          // secure: false
        }
      }
    },
    providers: [
      /* GitHubProvider({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }), */
      CredentialsProvider({
        // The name to display on the sign in form (e.g. "Sign in with...")
        name: "Credentials",
        // `credentials` is used to generate a form on the sign in page.
        // You can specify which fields should be submitted, by adding keys to the `credentials` object.
        // e.g. domain, username, password, 2FA token, etc.
        // You can pass any HTML attribute to the <input> tag through the object.
        credentials: {
          email: { label: "Email", type: "email", placeholder: "aitorjs@ni.eus" },
          password: { label: "Password", type: "password", placeholder: "Your password" }
        },
        async authorize(credentials, req) {
          let user = null

          /*  const saltedPasswordToCheck = await passwordToSalt(credentials.password)
           console.log('saltedPasswordToCheck', credentials.email, saltedPasswordToCheck) */

          user = await getUserFromDb(credentials.email, credentials.password)

          console.log('user 123', user)

          if (!user) {
            // throw new Error("User was not found.")
            return null
          }

          return user
        },
      }),
    ],
    session: { strategy: 'jwt' },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
    callbacks: {
      async signIn({ user, account, profile, email, credentials }) {
        // console.log("signIn", { user, account, profile, email, credentials })
        return true
      },
      async redirect({ url, baseUrl }) {
        // console.log("redirect", url, baseUrl)
        return process.env.CLIENT_BASE_URL!

      },
      async session({ session, user, token }) {
        // console.log("session", { session, user, token })
        return session
      },
      async jwt({ token, user, account, profile, isNewUser }) {
        console.log("jwt", { token, user, account, profile, isNewUser })

        if (user) {
          token.id = user.id
          token.roles = user.roles
          token.username = user.username
          token.avatar = user.avatar
        }
        console.log('token', token)
        return token
      }
    },
    pages: {
      /*  signIn: "/login",
       signOut: '/logout', */
      // error: '/auth/error', // Error code passed in query string as ?error=
      // verifyRequest: '/auth/verify-request', // (used for check email message)
      // newUser: '/auth/new-user' // New users will be directed here on first sign in (leave the property out if not of interest)
    },
    events: {
      async createUser({ user }) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            active: false,
            roles: "3", // user
          }
        })

        return
      }
    },
  }
}
/* END auth */

/* Multimedia */
// https://youtu.be/ICfWrnabzHo?si=xFu7lTc8iYPJXkdq&t=401
app.post("/upload", async (c) => {
  // TODO: Make multimedia folder on first load?
  const supportedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  const baseFolder = env(c).VITE_UPLOAD_FOLDER
  const data = await c.req.formData()
  const files = data.getAll("file")
  console.log("files", files)

  const pa = files.map(async f => {
    console.log("fileServer", f)
    if (!supportedTypes.includes(f.type)) return false

    const buffer = await f!.arrayBuffer()
    try {
      const ext = f.name.split(".")[1]
      const filename = generateRandomString()
      fs.writeFileSync(`${baseFolder}/${filename}.${ext}`, Buffer.from(buffer))
      console.log('Data written')

      const newMultimedia = await prisma.multimedia.create({
        data: {
          name: `${filename}.${ext}` as string,
        },
      })

      console.log("multimedia", newMultimedia)

      return newMultimedia
    } catch (e) {
      console.log("ERROR", e)
      return c.text('Fail', 201)
    }
  })

  const pb = await Promise.all(pa)
  return c.json(pb, 201)
})

// const don = await prisma.don.upsert({
//   where: { id: Number(data.donId) },
//   update: {
//     users: {
//       upsert: {
//         where: {
//           id: 10,
//         },
//         update: {
//           multimedia: data.allFiles.map(({ id }) => id),
//         },
//         create: {
//           userId: data.userId,
//           multimedia: [],
//           description: "description2",
//           latitude: 2,
//           longitude: 2,
//         }
//       }
//     }
//   },
//   create: {
//     title: "title"
//   }
// })


// const u = await prisma.don.update({
//   where: {
//     id: data.donId
//   },
//   include: { users: true },
//   data: {
//     users: {
//       connectOrCreate: {

//         [{ "id": "2423f329-92b6-4efd-b07c-30bdf5d01bbc" }],
//       }
//     },
//     /* where: {
//       donId: data.donId,
//       userId: data.userId
//     } */
//   }
// })

app.delete("/upload", async (c) => {
  const baseFolder = env(c).VITE_UPLOAD_FOLDER
  const file = await c.req.json() as BodyData

  try {
    const deleteMultimedia = await prisma.multimedia.delete({
      where: {
        id: file.id,
      },
    })

    const donUsers: Donusers = await prisma.$queryRaw`SELECT id FROM "Donusers" WHERE "donId" = ${file.donId} AND "userId" = ${file.userId}`

    console.log("donUsers", donUsers)
    const multimedia = file.allFiles.filter((_f, idx) => idx !== file.thumb_index)
    console.log("multimedia", multimedia)
    await prisma.don.update({
      where: { id: file.donId },
      data: {
        users: {
          update: {
            data: {
              multimedia: multimedia.map(({ id }) => id) ?? [],
            },
            where: { id: donUsers[0].id }
          }
        }
      }
    })

    /*  multimedia = multimedia.map(({ id }) => id)
     await prisma.donusers.update({
       where: {
         id: donUsers[0].id
       },
       data: {
         multimedia
       }
     }) */

    fs.unlink(`${baseFolder}/${deleteMultimedia.name}`, (e) => {
      if (e) throw e
      console.log(`${baseFolder}/${deleteMultimedia.name} was deleted`)
    })

    return c.json(deleteMultimedia, 201)
  } catch (e) {
    console.log("ERROR on deleting file from disk or bbdd", e)
    return c.text('Fail', 201)
  }
})

app.get('/multimedia', async (c) => {
  const multimedias = await prisma.multimedia.findMany({
    orderBy: [{
      updatedAt: 'desc',
    }],
  })

  console.log("multimedias", multimedias)
  return c.json(multimedias)
})
/* END Multimedia */

/* Dons */
app.post('/dons2', async (c) => {
  const { categories, distance = 0, search }: { categories: Category[], distance: number, search: string } = await c.req.json()

  // bulebard
  const center = {
    lat: 43.3216844,
    lng: -1.9847743,
  }

  // plaza centenario (mas/menos a 1KM del bulebard): 43.313113, -1.980210 {"lat":43.313113, "lng":-1.980210}
  // calle etxebeste (mas/menos a 1.2KM del bulebard): 43.3163913,-1.9878492 {"lat":43.3163913, "lng":-1.9878492}
  //const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`

  // SELECT ST_DistanceSphere(ST_MakePoint(43.3216844, -1.9847743),ST_MakePoint(43.313113, -1.980210));  1079.30167292 metros
  // SELECT ST_DistanceSphere(ST_MakePoint(43.3216844, -1.9847743),ST_MakePoint(43.3163913, -1.9878492));  680.36723853 metros
  // SELECT id FROM "Post" WHERE ST_DWithin(ST_MakePoint(longitude, latitude), ST_MakePoint(-1.9847743, 43.3216844)::geography, radius * 1000)
  // const radius = 1100

  let query = ""
  const filters: [any] = []

  if (categories.length > 0) {
    filters.push({
      don: {
        categories: {
          hasSome: categories
        }
      }
    })
    console.log("has categories")
  }

  if (distance > 0) {
    console.log("has distance")
    query = await prisma.$queryRaw`SELECT * FROM "Donusers" WHERE ST_DWithin(ST_MakePoint(latitude, longitude), ST_MakePoint(${center.lat}, ${center.lng})::geography, ${distance})`
    // const query = await prisma.$queryRaw`SELECT * FROM "Post" WHERE ST_DWithin(ST_MakePoint(latitude, longitude), ST_MakePoint(43.3216844, -1.9847743):: geography, 1300)`
    console.log('query', query)
    filters.push({
      id: {
        in: query.map(({ id }) => id)
      }
    })
  }

  if (search !== "") {
    filters.push({
      OR: [
        {
          description: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          don: {
            title: {
              contains: search,
              mode: "insensitive",
            }
          }
        }
      ]
    })

    console.log("has search")
  }

  console.log('filters', JSON.stringify(filters))

  console.log('categories', categories)
  const dons = await prisma.donusers.findMany({
    where: {
      AND: filters,

      /* [
        {
          OR:
            [
              {
              description: {
                      contains: search,
                mode: "insensitive",
              },
              },
              {
              don: {
                title: {
                  contains: search,
                  mode: "insensitive",
                }
              }
            }
            ]
        },
        {
        don: {
          categories: {
            hasSome: categories
          }
        }
        }
      ], */
      // userId: 1
    },
    include: {
      user: true,
      don: true,
    },
    orderBy: [
      { donId: 'desc' }
    ]
  })
  console.log('dons', dons)

  const promises = dons.map(async (d, index) => {

    if (d.don.categories.length > 0) {
      const categories = d.don.categories
      const pa = categories.map(async c =>
        await prisma.category.findUnique({ where: { id: c } })
      )
      dons[index].don.categories = await Promise.all(pa)
    }

    if (d.multimedia.length > 0) {
      const pb = d.multimedia.map(async (m) =>
        await prisma.multimedia.findUnique({ where: { id: m } })
      )
      dons[index].multimedia = await Promise.all(pb)
    }

    if (d.user.avatar !== null) {
      const avatar = await prisma.multimedia.findUnique(
        { where: { id: d.user.avatar } }
      )
      dons[index].user.avatar = avatar!.name
    }
  })
  await Promise.all(promises)
  const count = dons.length
  //  const result = Object.groupBy(posts, ({ user }) => user.title)
  let result = Object.groupBy(dons, ({ don }) => don.title)

  return c.json({ result, count })
})
app.get('/dons', async (c) => {
  const { token } = await getAuthUser(c)
  const rol = token?.roles?.title
  console.log('rol', rol)
  let dons = {}

  if (rol === "superroot") {
    dons = await prisma.don.findMany({
      include: {
        users: {
          include: {
            user: true,
          },
        }
      },
      orderBy: [{
        updatedAt: 'desc',
      }],
    })
  } else if (rol === "user") {
    console.log('token es aqui', token)
    const userId = token.id
    dons = await prisma.don.findMany({
      where: {
        users: {
          every: { userId }
        }
      },
      include: {
        users: {
          include: {
            user: true,
          },
        }
      },
      orderBy: [{
        updatedAt: 'desc',
      }],
    })
  }

  const promises = dons.map(async (d, index) => {
    // fill categories with their object
    if (d.categories.length > 0) {
      const pa = d.categories.map(async (c) =>
        await prisma.category.findUnique({ where: { id: c } })
      )
      dons[index].categories = await Promise.all(pa)
    }

    // fill multimedia with their object
    /*  if (d.multimedia.length > 0) {
       const pb = d.multimedia.map(async (m) =>
         await prisma.multimedia.findUnique({ where: { id: m } })
       )
       dons[index].multimedia = await Promise.all(pb)
     } */
  })
  await Promise.all(promises)

  return c.json(dons)
})

app.get('/dons/:id', async (c) => {
  // NOTE: Don data leak doesnt matter. Only user is important!
  /*  const admitRoles = ["superroot", "owner"]
  const isauth = await isAuth(c, admitRoles)
  if (!isauth) return c.json({ message: 'access denied' }) */

  const id = c.req.param('id')
  const don = await prisma.don.findUnique({
    include: {
      users: {
        include: {
          user: true
        }
      }
    },
    where: {
      id,
      /*  users: {
         every: { userId: 1 }
       }  */
    },
  })

  if (don!.users.length > 0) {
    const pa = don!.users.map(async (m, index) => {
      const pb = m.multimedia.map(async (m) =>
        await prisma.multimedia.findUnique({ where: { id: m } })
      )
      don!.users[index].multimedia = await Promise.all(pb)

      if (m.user.avatar) {
        const avatar = await prisma.multimedia.findUnique(
          { where: { id: m.user.avatar } }
        )
        don!.users[index].user.avatar = avatar
      }
    })

    await Promise.all(pa)
  }

  console.log("multimedia111", don)
  return c.json(don)
})

app.post('/dons/new', async (c) => {
  const admitRoles = ["superroot", "user"]
  await isAuth(c, admitRoles)

  const body = await c.req.json() as BodyData
  console.log(' body!!!', body)
  const newDon: Don = await prisma.don.create({
    data: {
      title: body.title as string,
      categories: body.categories as string[],
      users: {
        create: {
          userId: body.users[0].userId,
          description: body.users[0].description,
          multimedia: body.users[0].multimedia.map(({ id }) => id),
          latitude: 1,
          longitude: 1
        }
      }
    }
  })

  console.log('newDon', newDon)
  return c.json(newDon)
})

app.post('/dons/checkMultimedias/:donId', async (c) => {
  const baseFolder = env(c).VITE_UPLOAD_FOLDER
  const donId = c.req.param('donId')
  const data = await c.req.formData()
  const files = data.getAll("file")
  const ids = data.getAll("ids")
  console.log('files', files, ids[0], donId)

  const pa = files.map(async (f, findex) => {
    const c = await prisma.multimedia.findUnique({
      where: {
        name: f.name
      }
    })
    console.log('c', c)
    if (c === null) {
      console.log('files[index]', files[findex])
      const buffer = await files[findex].arrayBuffer()
      const ext = files[findex].name.split(".")[1]
      const filename = generateRandomString()

      fs.writeFileSync(`${baseFolder}/${filename}.${ext}`, Buffer.from(buffer))
      console.log('Data written')

      const newMultimedia = await prisma.multimedia.create({
        data: {
          name: `${filename}.${ext}` as string,
        },
      })

      return newMultimedia.id
    }
    return c.id
  })

  const multimediaIds = await Promise.all(pa)
  console.log('multimediaIds', multimediaIds)

  const donUsers: Donusers = await prisma.$queryRaw`SELECT id FROM "Donusers" WHERE "donId" = ${donId} AND "userId" = ${firstUserId}`
  console.log("donUsers", donUsers)
  await prisma.donusers.update({
    where: {
      id: donUsers[0].id
    },
    data: {
      multimedia: multimediaIds,

    }
  })

  return c.json(true)
})

app.put('/dons/:id', async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json() as BodyData
  console.log(' body!!!', body, JSON.stringify(body.users), id)

  const admitRoles = ["superroot", "owner"]
  const isauth = await isAuth(c, admitRoles, body.users[0].user.id)
  if (!isauth) return c.json({ message: 'access denied' })

  const updatedDon: Don = await prisma.don.update({
    where: {
      id
    },
    include: {
      users: true
    },
    data: {
      title: body.title as string,
      categories: body.categories,
    }
  })
  console.log('body!!!  dons id', body.users)
  const pa = body.users.map(async (u, index) => {
    console.log("ata es ata", body.users[index].multimedia)
    console.log("user", updatedDon.users[index].id)
    await prisma.donusers.update({
      where: {
        id: updatedDon.users[index].id
      },
      data: {
        userId: body.users[index].userId,
        description: body.users[index].description as string,
        /* multimedia: body.users[index].multimedia
          .filter((f) => Object.getOwnPropertyNames(f).length > 0)
          .map(({ id }) => id), */
        multimedia: body.users[index].multimedia.map(m => m.id),
        latitude: 1,
        longitude: 1,
        donId: updatedDon.id
      }
    })
  })

  console.log('updatedDon', updatedDon)
  c.status(200)
  return c.json(updatedDon)
})

app.delete('/dons/:id', async (c) => {
  const admitRoles = ["superroot", "owner"]
  const { token } = await getAuthUser(c)
  const userId = token?.id

  const isauth = await isAuth(c, admitRoles, userId)
  if (!isauth) return c.json({ message: 'access denied' })

  const id = c.req.param('id')
  const baseFolder = env(c).VITE_UPLOAD_FOLDER

  const donUsers: any = await prisma.donusers.findFirst({
    where: {
      donId: id
    },
  })

  await prisma.donusers.delete({
    where: {
      id: donUsers.id
    },
  })

  const deletedDon: Don = await prisma.don.delete({
    where: {
      id
    }
  })

  console.log('deletedDon', deletedDon, deletedDon.multimedia)
  if (deletedDon.hasOwnProperty('multimedia')) {
    const pa = deletedDon.multimedia.map(async m => await prisma.multimedia.delete({
      where: {
        id: m
      }
    }))
    const deletedMultimedia = await Promise.all(pa)
    console.log('deletedMultimedia', deletedMultimedia)

    deletedMultimedia.map(m => fs.unlink(`${baseFolder}/${m.name}`, (e) => {
      if (e) throw e
      console.log(`${baseFolder}/${m.name} was deleted`)
    }))
  }

  c.status(200)
  return c.json(deletedDon)
})
/* END Dons */

/* Categories */
app.post('/categories/new', async (c) => {
  const admitRoles = ["superroot"]
  const isauth = await isAuth(c, admitRoles)
  if (!isauth) return c.json({ message: 'access denied' })

  const body = await c.req.json() as BodyData
  console.log('body', body)
  const newCategory = await prisma.category.create({
    data: {
      title: body.title as string,
    },
  })

  return c.json(newCategory)
})
/* END Categories */


/* Users */
app.get('/user/username/:username', async (c) => {
  const username = c.req.param('username')
  /* const user = await prisma.user.findUnique({
    where: { username, id: "1" }
  }) */

  const user: User[] = await prisma.$queryRaw`SELECT username FROM "User" WHERE username = '${username}'`

  console.log('user!!!!', user)
  if (user.length > 0) return c.json(false)

  return c.json(true)
})

app.get('/user/email/:email', async (c) => {
  const email = c.req.param('email')
  const user = await prisma.user.findUnique({
    where: { email }
  })

  if (user) return c.json(false)

  return c.json(true)
})

app.get('/users', async (c) => {
  const admitRoles = ["superroot"]
  await isAuth(c, admitRoles)

  let users = await prisma.user.findMany({
    orderBy: [{
      updatedAt: 'desc',
    }],
  })

  const pa = users.map(async (u) => {
    console.log('users', u)
    const role = await prisma.role.findUnique({
      where: { id: Number(u.roles) }
    })
    console.log('role', role)
    delete u.password
    u.roles = role!.title
    return u
  })
  const pb = await Promise.all(pa)
  const pc = pb.map(async (u, index) => {
    users[index].roles = u.roles

    if (u.avatar) {
      const avatar = await prisma.multimedia.findUnique({ where: { id: u.avatar } })
      users[index].avatar = avatar!.name
    }

    return users[index]
  })

  users = await Promise.all(pc)
  return c.json(users)
})

app.get('/users/:id', async (c) => {
  const admitRoles = ["superroot", "owner"]
  const isauth = await isAuth(c, admitRoles)
  console.log('isauth', isauth)
  if (!isauth) return c.json({ message: 'access denied' })

  const id = c.req.param('id')
  const user = await prisma.user.findUnique({
    where: {
      id,
      /*  users: {
         every: { userId: 1 }
       }  */
    },
  })
  if (user!.avatar) {
    user!.avatar = await prisma.multimedia.findUnique({ where: { id: user.avatar } })
  }
  delete user!.password

  return c.json(user)
})

app.post('/users/new', async (c) => {
  /* const admitRoles = ["superroot", "owner"]
  await isAuth(c, admitRoles) */

  const body = await c.req.json() as BodyData
  console.log(' body add new', body)

  // TODO: passwordToSalt(body.password)
  const saltRounds = 10
  body.password = await bcrypt.hash(body.password, saltRounds)

  const newUser = await prisma.user.create({
    data: {
      username: body.username as string,
      email: body.email as string,
      emailVerified: null,
      password: body.password as string,
      avatar: body.avatar.length > 0 ? body.avatar[0].id : null,
      roles: Number(body.roles) || 3,
      latitude: body.latitude,
      longitude: body.longitude,
      active: false,
      contacts: body.contacts
    }
  })

  // const isValidPassword = await bcrypt.compare(password, hash)
  console.log('newUser', newUser)
  return c.json(newUser)
})

app.put('/users/:id', async (c) => {
  const admitRoles = ["superroot", "owner"]
  const isauth = await isAuth(c, admitRoles)
  if (!isauth) c.json({ message: 'access denied' })

  const { id, users: _users, ...body } = await c.req.json() as BodyData
  console.log(' body!!! ES AQUI', body, JSON.stringify(body.users), id)
  body.avatar = body.avatar.map(({ id }) => id)[0] ?? null
  body.roles = Number(body.roles)
  const updateUser = await prisma.user.update({
    where: {
      id
    },
    data: body
  })

  return c.json(updateUser)
})

app.delete('/users/:id', async (c) => {
  const admitRoles = ["superroot", "owner"]
  const isauth = await isAuth(c, admitRoles)
  if (!isauth) return c.json({ message: 'access denied' })

  const baseFolder = env(c).VITE_UPLOAD_FOLDER
  const id = c.req.param('id')

  const deletedUser: User = await prisma.user.delete({
    where: {
      id
    }
  })

  if (deletedUser.avatar) {
    const deleteMultimedia = await prisma.multimedia.delete({
      where: {
        id: deletedUser.avatar,
      }
    })

    fs.unlink(`${baseFolder}/${deleteMultimedia.name}`, (e) => {
      if (e) throw e
      console.log(`${baseFolder}/${deleteMultimedia.name} was deleted`)
    })
  }
  console.log('deletedUser', deletedUser)
  return c.json(deletedUser)
})

app.delete("/user/upload", async (c) => {
  const admitRoles = ["superroot", "owner"]
  const isauth = await isAuth(c, admitRoles)
  if (!isauth) return c.json({ message: 'access denied' })


  const baseFolder = env(c).VITE_UPLOAD_FOLDER
  const file = await c.req.json() as BodyData

  try {
    const deleteMultimedia = await prisma.multimedia.delete({
      where: {
        id: file.id,
      },
    })

    await prisma.user.update({
      where: { id: firstUserId },
      data: {
        avatar: null
      }
    })

    fs.unlink(`${baseFolder}/${deleteMultimedia.name}`, (e) => {
      if (e) throw e
      console.log(`${baseFolder}/${deleteMultimedia.name} was deleted`)
    })

    return c.json(deleteMultimedia, 201)
  } catch (e) {
    console.log("ERROR on deleting user avatar from disk or bbdd", e)
    return c.text('Fail', 201)
  }
})
/* END Users */

/* Serve public files */
app.use('/public/*', serveStatic({ root: './' }))
/* END Serve public files */

const port = 3000
console.log(`Server is running on port ${port}`)

serve({
  fetch: app.fetch,
  port
})
