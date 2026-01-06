import { spoofMediaQuery } from '../helpers'

const display = () => {
  const undoSpoof = spoofMediaQuery('prefers-reduced-motion', 'no-preference')
  return undoSpoof
}

export default display
