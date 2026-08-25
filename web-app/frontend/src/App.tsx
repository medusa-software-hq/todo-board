import { Alert, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { useCallback, useState } from 'react';
import {
  TdbApiError,
  TdbCounterResponseKinds,
  type TdbApiClient,
  type TdbApiErrorKind,
  TdbApiErrorKinds,
} from './TdbApiClient.ts';
import { assertNever } from './assertNever.ts';

/** Which way a counter is being moved. */
type TdbCounterDirection = 'up' | 'down';

/** A counter the service made for us, and the last count it told us. */
type Counter = {
  counterId: string;
  count: number;
};

/**
 * Runs [call], handing the result to [onSuccess] and a failed call's kind to [onError].
 *
 * Only a `TdbApiError` is caught. Anything else is a bug in this page rather than an answer from
 * the service, and swallowing it here would be how it goes unnoticed.
 */
async function catchingApiError<ResultT>(
  call: () => Promise<ResultT>,
  onSuccess: (result: ResultT) => void,
  onError: (errorKind: TdbApiErrorKind) => void,
): Promise<void> {
  let result: ResultT;

  try {
    result = await call();
  } catch (cause) {
    if (!(cause instanceof TdbApiError)) {
      throw cause;
    }

    onError(cause.kind);

    return;
  }

  onSuccess(result);
}

/** What to say about a call that produced no answer. Chosen here, not carried by the error. */
function describeApiError(errorKind: TdbApiErrorKind): string {
  switch (errorKind) {
    case TdbApiErrorKinds.network:
      return 'The service could not be reached.';
    case TdbApiErrorKinds.internalServerError:
      return 'The service failed to handle that.';
    case TdbApiErrorKinds.incompatibility:
      return 'The service answered something this page cannot read.';
  }
}

/**
 * The counters this browser has made.
 *
 * The API has no way to list them, so a counter is only reachable while its id is held here — a
 * reload starts over. That is the API's shape showing through rather than a decision taken here.
 */
export default function App({ apiClient }: { apiClient: TdbApiClient }) {
  const [counters, setCounters] = useState<Counter[]>([]);
  const [apiErrorKind, setApiErrorKind] = useState<TdbApiErrorKind | null>(null);
  const [missingCounter, setMissingCounter] = useState(false);

  const forget = useCallback((counterId: string) => {
    setCounters((current) => current.filter((counter) => counter.counterId !== counterId));
  }, []);

  /** A counter the service does not have is one this page should stop showing. */
  const dropMissing = useCallback(
    (counterId: string) => {
      setMissingCounter(true);
      forget(counterId);
    },
    [forget],
  );

  const record = useCallback((counterId: string, count: number) => {
    setApiErrorKind(null);
    setMissingCounter(false);
    setCounters((current) =>
      current.map((counter) => (counter.counterId === counterId ? { counterId, count } : counter)),
    );
  }, []);

  const addCounter = useCallback(
    async () =>
      catchingApiError(
        () => apiClient.createCounter(),
        (counterId) => {
          setApiErrorKind(null);
          setMissingCounter(false);
          setCounters((current) => [...current, { counterId, count: 0 }]);
        },
        setApiErrorKind,
      ),
    [apiClient],
  );

  const move = useCallback(
    async (counterId: string, direction: TdbCounterDirection) =>
      catchingApiError(
        () =>
          direction === 'up'
            ? apiClient.incrementCount(counterId)
            : apiClient.decrementCount(counterId),
        (response) => {
          switch (response.kind) {
            case TdbCounterResponseKinds.adjusted:
              record(counterId, response.newCount);
              break;
            case TdbCounterResponseKinds.noSuchCounter:
              dropMissing(counterId);
              break;
            default:
              assertNever(response);
          }
        },
        setApiErrorKind,
      ),
    [apiClient, record, dropMissing],
  );

  const refresh = useCallback(
    async (counterId: string) =>
      catchingApiError(
        () => apiClient.getCount(counterId),
        (response) => {
          switch (response.kind) {
            case TdbCounterResponseKinds.received:
              record(counterId, response.currentCount);
              break;
            case TdbCounterResponseKinds.noSuchCounter:
              dropMissing(counterId);
              break;
            default:
              assertNever(response);
          }
        },
        setApiErrorKind,
      ),
    [apiClient, record, dropMissing],
  );

  const remove = useCallback(
    async (counterId: string) =>
      catchingApiError(
        () => apiClient.deleteCounter(counterId),
        // Gone is gone, whether or not it was there a moment ago.
        () => {
          setApiErrorKind(null);
          setMissingCounter(false);
          forget(counterId);
        },
        setApiErrorKind,
      ),
    [apiClient, forget],
  );

  return (
    <Container size="sm" py="xl">
      <Stack>
        <Title order={1}>Todo Board</Title>

        <Group>
          <Button onClick={() => void addCounter()}>Add a counter</Button>
        </Group>

        {apiErrorKind && (
          <Alert color="red" title="Something went wrong">
            {describeApiError(apiErrorKind)}
          </Alert>
        )}

        {missingCounter && (
          <Alert color="yellow" title="That counter is gone">
            The service has no counter with that id.
          </Alert>
        )}

        {counters.length === 0 && <Text c="dimmed">No counters yet.</Text>}

        {counters.map((counter) => (
          <Card key={counter.counterId} withBorder padding="md">
            <Group justify="space-between">
              <Stack gap={0}>
                <Text size="xl" fw={700}>
                  {counter.count}
                </Text>
                <Text size="xs" c="dimmed">
                  {counter.counterId}
                </Text>
              </Stack>

              <Group>
                <Button
                  variant="default"
                  onClick={() => void move(counter.counterId, 'down')}
                  aria-label="Decrement"
                >
                  −
                </Button>
                <Button
                  variant="default"
                  onClick={() => void move(counter.counterId, 'up')}
                  aria-label="Increment"
                >
                  +
                </Button>
                <Button variant="subtle" onClick={() => void refresh(counter.counterId)}>
                  Refresh
                </Button>
                <Button color="red" variant="subtle" onClick={() => void remove(counter.counterId)}>
                  Delete
                </Button>
              </Group>
            </Group>
          </Card>
        ))}
      </Stack>
    </Container>
  );
}
