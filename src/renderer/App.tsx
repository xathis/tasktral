import {
  Box,
  Button,
  ChakraProvider,
  HStack,
  Heading,
  Spinner,
  VStack,
  extendTheme,
  useToast,
} from '@chakra-ui/react';
import { Mistral } from '@mistralai/mistralai';
import React from 'react';
import { HiMinus, HiX } from 'react-icons/hi';
import { Route, MemoryRouter as Router, Routes } from 'react-router-dom';
import { useDispatch } from 'zutron';
import { useStore } from './hooks/useStore';
import { RunHistory } from './RunHistory';
import { Stats } from './Stats';

function Main() {
  const dispatch = useDispatch(window.zutron);
  const {
    instructions: savedInstructions,
    fullyAuto,
    running,
    error,
    runHistory,
  } = useStore();
  // Add local state for instructions

  const [localInstructions, setLocalInstructions] = React.useState(
    savedInstructions ?? '',
  );
  const toast = useToast(); // Add toast hook

  const [isInputMode, setIsInputMode] = React.useState(true);

  const [tasks, setTasks] = React.useState();

  const [isStatsMode, setIsStatsMode] = React.useState(false);

  const startRun = () => {
    // Update Zustand state before starting the run
    dispatch({ type: 'SET_INSTRUCTIONS', payload: localInstructions });
    dispatch({ type: 'RUN_AGENT', payload: null });
  };

  const parseInput = async () => {
    // Predefined colors for up to 5 tasks
    const taskColors = ['#FF0000', '#006600', '#0000FF', '#FF00FF', '#00FFFF'];

    const apiKey = await window.electron.env.getApiKey();
    const client = new Mistral({ apiKey });
    console.log('Start parse input');
    const chatResponseTasks = await client.chat.complete({
      responseFormat: { type: 'json_object' },
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `an array named "tasks" of objects with the following properties: title (e.g. "Write a blog post"), timeValue: (e.g. 10), timeUnit (seconds, minutes or hours), e.g.
  {
    "tasks": [
      {
        "title": "Write a blog post",
        "timeValue": 10,
        "timeUnit": "minutes"
      },
      {
        "title": "Write a blog post",
        "timeValue": 2,
        "timeUnit": "hours"
      }
    ]
  }
  `,
            },
            {
              type: 'text',
              text: localInstructions || '',
            },
          ],
        },
      ],
    });

    const parsedTasks = chatResponseTasks.choices?.[0]?.message?.content
      ? JSON.parse(chatResponseTasks.choices[0].message.content as string)
          ?.tasks
      : { tasks: [] } || [];

    console.log({ parsedTasks });

    // Add colors to tasks
    const tasksWithColors = parsedTasks.map((task: any, index: number) => ({
      ...task,
      color: taskColors[index],
      progress: index * 26.4 + Math.random() * 10,
    }));

    setTasks(tasksWithColors);

    dispatch({ type: 'SET_TASKS', payload: tasksWithColors });

    // write tasks to tasks.json
    // fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));

    console.log({ tasks: tasksWithColors });
  };

  if (isStatsMode) {
    return <Stats onCancel={() => setIsStatsMode(false)} />;
  }

  return (
    <Box
      position="relative"
      w="100%"
      h="100vh"
      p={4}
      sx={{
        '-webkit-app-region': 'drag', // Make the background draggable
      }}
    >
      {/* Title heading no longer needs drag property since parent is draggable */}
      <Box position="absolute" top={2} left={6}>
        <Heading fontFamily="Garamond, serif" fontWeight="hairline">
          TASKTRAL AI_
        </Heading>
      </Box>

      {/* Window controls and GitHub button moved together */}
      <HStack
        position="absolute"
        top={2}
        right={2}
        spacing={0}
        sx={{
          '-webkit-app-region': 'no-drag',
        }}
      >
        {/* <Link href="https://github.com/corbt/agent.exe" isExternal>
          <Button variant="ghost" size="sm" aria-label="GitHub" minW={8} p={0}>
            <FaGithub />
          </Button>
        </Link> */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.electron.windowControls.minimize()}
          minW={8}
          p={0}
        >
          <HiMinus />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => window.electron.windowControls.close()}
          minW={8}
          p={0}
        >
          <HiX />
        </Button>
      </HStack>

      <VStack
        spacing={4}
        align="center"
        h="100%"
        w="100%"
        pt={16}
        sx={{
          '& > *': {
            // Make all direct children non-draggable
            '-webkit-app-region': 'no-drag',
          },
        }}
      >
        <Box alignSelf="flex-start" pl={4} fontSize="lg">
          Good morning - tasks for today?
        </Box>
        {!tasks && (
          <Box
            as="textarea"
            placeholder="What can I do for you today?"
            width="100%"
            height="auto"
            minHeight="220px"
            p={4}
            borderRadius="16px"
            border="1px solid"
            borderColor="rgba(112, 107, 87, 0.5)"
            verticalAlign="top"
            resize="none"
            overflow="hidden"
            sx={{
              '-webkit-app-region': 'no-drag',
              transition: 'box-shadow 0.2s, border-color 0.2s',
              _hover: {
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
              },
              _focus: {
                borderColor: 'blackAlpha.500',
                outline: 'none',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              },
            }}
            value={localInstructions}
            disabled={running}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setLocalInstructions(e.target.value);
              // Auto-adjust height
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            // onKeyDown={handleKeyDown}
          />
        )}
        {tasks && (
          <VStack w="100%" spacing={3} align="flex-start" pl={4}>
            {(tasks as any).map((task: any) => (
              <HStack key={task.title} spacing={3}>
                <Box w="12px" h="12px" borderRadius="3px" bg={task.color} />
                <Box>
                  ({task.timeValue} {task.timeUnit}) {task.title}
                </Box>
              </HStack>
            ))}
          </VStack>
        )}
        <HStack justify="space-between" align="center" w="100%">
          {/* <HStack spacing={2}>
            <Switch
              isChecked={fullyAuto}
              onChange={(e) => {
                toast({
                  description:
                    "Whoops, automatic mode isn't actually implemented yet. 😬",
                  status: 'info',
                  duration: 3000,
                  isClosable: true,
                });
              }}
            />
            <Box>Full Auto</Box>
          </HStack> */}
          <HStack>
            {running && <Spinner size="sm" color="gray.500" mr={2} />}
            {!running && runHistory.length > 0 && (
              <Button
                bg="transparent"
                fontWeight="normal"
                _hover={{
                  bg: 'whiteAlpha.500',
                  borderColor: 'blackAlpha.300',
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
                }}
                _focus={{
                  boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
                  outline: 'none',
                }}
                borderRadius="12px"
                border="1px solid"
                borderColor="blackAlpha.200"
                onClick={() => dispatch('CLEAR_HISTORY')}
                aria-label="Clear history"
              >
                Stop
              </Button>
            )}
            <Button
              bg="transparent"
              fontWeight="normal"
              _hover={{
                bg: 'whiteAlpha.500',
                borderColor: 'blackAlpha.300',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
              }}
              _focus={{
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
                outline: 'none',
              }}
              borderRadius="12px"
              border="1px solid"
              borderColor="blackAlpha.200"
              onClick={() => {
                if (isInputMode) {
                  setIsInputMode(false);
                  parseInput();
                } else {
                  startRun();
                }
              }}
              isDisabled={!running && localInstructions?.trim() === ''}
            >
              {isInputMode ? 'OK' : 'Start my day'}
            </Button>
            <Button
              bg="transparent"
              fontWeight="normal"
              _hover={{
                bg: 'whiteAlpha.500',
                borderColor: 'blackAlpha.300',
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
              }}
              _focus={{
                boxShadow: '0 1px 4px rgba(0, 0, 0, 0.05)',
                outline: 'none',
              }}
              borderRadius="12px"
              border="1px solid"
              borderColor="blackAlpha.200"
              onClick={() => {
                setIsStatsMode(!isStatsMode);
                dispatch({ type: 'STOP_RUN', payload: null });
              }}
            >
              Stats
            </Button>
          </HStack>
        </HStack>

        {/* Add error display */}
        {error && (
          <Box w="100%" color="red.700">
            {error}
          </Box>
        )}

        {/* RunHistory component */}
        <Box flex="1" w="100%" overflow="auto">
          <RunHistory />
        </Box>
      </VStack>
    </Box>
  );
}

const theme = extendTheme({
  styles: {
    global: {
      body: {
        color: 'rgb(83, 81, 70)',
      },
    },
  },
  components: {
    Switch: {
      baseStyle: {
        track: {
          bg: 'blackAlpha.200',
          _checked: {
            bg: '#c79060',
          },
        },
      },
    },
  },
});

export default function App() {
  return (
    <ChakraProvider theme={theme}>
      <Box bg="rgb(240, 238, 229)" minHeight="100vh">
        <Router>
          <Routes>
            <Route path="/" element={<Main />} />
          </Routes>
        </Router>
      </Box>
    </ChakraProvider>
  );
}
