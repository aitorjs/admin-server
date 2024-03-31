const apiUrl = "http://localhost:3000"

try {
  const response = await fetch(`${apiUrl}/dons2`)

  if (!response.ok) {
    throw new Error('Error al conseguir el Don')
  }

  const dons = await response.json()
  const keys = Object.keys(dons)

  keys.map(k => {
    console.log("key", k, dons[k][0].donId)
  })
} catch (e) {
  console.error('Error al conseguir los Dones:', e)
}

/* {
  "categories":[1], // or []
    "distance": 100, // or null in meters 
    "search": "huerta" // or ""
} */