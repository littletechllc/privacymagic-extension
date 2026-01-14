import { sharedSecret } from './secret'

const isolated = () => {
  const secret = sharedSecret()
  document.addEventListener(secret, (event) => {
    console.log('event received in isolated', event)
  })
  console.log('event listener added in isolated')
  console.log(`shared secret: "${secret}"`)
}

isolated()