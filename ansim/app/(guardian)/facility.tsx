import FacilityListScreen from '@/components/institutions/facility-list-screen';
import { useLocalSearchParams } from 'expo-router';

export default function GuardianFacilityScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  return <FacilityListScreen variant="guardian" returnRoute="/protector-main" subjectId={Number(subjectId)} />;
}
