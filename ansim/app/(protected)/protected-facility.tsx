import FacilityListScreen from '@/components/institutions/facility-list-screen';
import { useLocalSearchParams } from 'expo-router';

export default function ProtectedFacilityScreen() {
  const { subjectId } = useLocalSearchParams<{ subjectId?: string }>();
  return <FacilityListScreen variant="protected" returnRoute="/protected-main" subjectId={Number(subjectId)} />;
}
