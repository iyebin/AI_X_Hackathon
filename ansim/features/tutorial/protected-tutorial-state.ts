import AsyncStorage from '@react-native-async-storage/async-storage';

const tutorialKey = (subjectId: number) => `@ansim/protected-tutorial-completed:${subjectId}`;

export async function shouldShowProtectedTutorial(subjectId: number): Promise<boolean> {
  const value = await AsyncStorage.getItem(tutorialKey(subjectId));
  return value !== 'true';
}

export async function completeProtectedTutorial(subjectId: number): Promise<void> {
  await AsyncStorage.setItem(tutorialKey(subjectId), 'true');
}
