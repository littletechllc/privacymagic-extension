import { spoofMediaQuery } from '../helpers'

const display = (): void => {
  spoofMediaQuery('prefers-reduced-motion', 'no-preference')
}

export default display
