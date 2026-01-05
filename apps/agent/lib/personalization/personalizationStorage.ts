import { storage } from '@wxt-dev/storage'
import { useEffect, useState } from 'react'

export const personalizationStorage = storage.defineItem<string>(
  'local:personalization',
  {
    fallback: '',
  },
)

export function usePersonalization() {
  const [personalization, setPersonalizationState] = useState('')

  useEffect(() => {
    personalizationStorage.getValue().then(setPersonalizationState)
    const unwatch = personalizationStorage.watch((newValue) => {
      setPersonalizationState(newValue ?? '')
    })
    return unwatch
  }, [])

  const setPersonalization = async (value: string) => {
    await personalizationStorage.setValue(value)
  }

  const clearPersonalization = async () => {
    await personalizationStorage.setValue('')
  }

  return { personalization, setPersonalization, clearPersonalization }
}
