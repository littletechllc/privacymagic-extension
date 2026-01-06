import { spoofMediaQuery } from '../helpers'

const display = (): (() => void) => {
  const undoSpoof = spoofMediaQuery('prefers-reduced-motion', 'no-preference')
  return undoSpoof
}

export default display
