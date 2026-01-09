export async function run(agent: Agent) {
  // Navigate to Amazon
  const navResult = await agent.nav('https://www.amazon.com')
  if (!navResult.success) {
    throw new Error('Failed to navigate to Amazon')
  }

  // Search for Sensodyne toothpaste
  const searchResult = await agent.act('search for Sensodyne toothpaste')
  if (!searchResult.success) {
    throw new Error('Failed to search for Sensodyne toothpaste')
  }

  // Click on the first Sensodyne toothpaste product
  const selectResult = await agent.act(
    'click on the first Sensodyne toothpaste product in the search results',
  )
  if (!selectResult.success) {
    throw new Error('Failed to select product')
  }

  // Add the product to cart
  const addToCartResult = await agent.act('click the Add to Cart button')
  if (!addToCartResult.success) {
    throw new Error('Failed to add product to cart')
  }

  // Verify the product was added to cart
  const verifyResult = await agent.verify(
    'the product has been added to cart or a cart confirmation is shown',
  )
  if (!verifyResult.success) {
    throw new Error(
      `Failed to verify product added to cart: ${verifyResult.reason}`,
    )
  }
}
