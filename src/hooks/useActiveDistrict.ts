import { useParams } from 'react-router-dom'
import { getGwangjuDistrict, gwangjuDistricts } from '@/data/gwangjuDistricts'

export function useActiveDistrict() {
  const { district } = useParams<{ district: string }>()
  return getGwangjuDistrict(district) ?? gwangjuDistricts[0]
}
