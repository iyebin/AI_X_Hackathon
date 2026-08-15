import FacilityListScreen from '@/components/institutions/facility-list-screen';
import { useLocalSearchParams } from 'expo-router';

export default function GuardianFacilityScreen() {
  const { subjectId, targetName, targetStatus, targetScore, targetGps, targetPhone, updatedTime } = useLocalSearchParams<{
    subjectId?: string;
    targetName?: string;
    targetStatus?: string;
    targetScore?: string;
    targetGps?: string;
    targetPhone?: string;
    updatedTime?: string;
  }>();

  return (
    <FacilityListScreen
      variant="guardian"
      returnRoute={{
        pathname: '/protector-main',
        params: { subjectId, targetName, targetStatus, targetScore, targetGps, targetPhone, updatedTime },
      }}
      subjectId={Number(subjectId)}
    />
  );
}
