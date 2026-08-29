import { Button, Card, Container, Stack, Text, Title } from '@mantine/core';
import { useTdbAuth } from './TdbAuthContext.ts';

/** What there is to see when nobody is signed in: an invitation, and nothing of the app itself. */
export function TdbSignInWall() {
  const { signIn } = useTdbAuth();

  return (
    <Container size="sm" py="xl">
      <Card withBorder padding="xl">
        <Stack>
          <Title order={1}>Todo Board</Title>

          <Text c="dimmed">Sign in with your organization account to continue.</Text>

          <Button onClick={signIn}>Sign in with Google</Button>
        </Stack>
      </Card>
    </Container>
  );
}
