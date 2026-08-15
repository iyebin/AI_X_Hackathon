import FacilityListScreen from '@/components/institutions/facility-list-screen';
import { useLocalSearchParams } from 'expo-router';

export default function ProtectedFacilityScreen() {
  const { subjectId, targetName } = useLocalSearchParams<{ subjectId?: string; targetName?: string }>();
  return (
    <FacilityListScreen
      variant="protected"
      returnRoute={{ pathname: '/protected-main', params: { subjectId, userName: targetName } }}
      subjectId={Number(subjectId)}
    />
  );
}
