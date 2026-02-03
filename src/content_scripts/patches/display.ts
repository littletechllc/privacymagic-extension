import { spoofMediaQuery } from '@src/content_scripts/helpers/helpers'

const display = (): void => {
  spoofMediaQuery('prefers-reduced-motion', 'no-preference')
}

export default display
