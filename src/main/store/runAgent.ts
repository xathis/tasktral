import { BetaMessageParam } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { Button, Key, keyboard, mouse, Point } from '@nut-tree-fork/nut-js';
// import { createCanvas, loadImage } from 'canvas';
import { Mistral } from '@mistralai/mistralai';
import { BrowserWindow, desktopCapturer, screen } from 'electron';
import fs from 'fs';
import path from 'path';
import { hideWindowBlock } from '../window';
import { anthropic } from './anthropic';
import { AppState, NextAction } from './types';

const MAX_STEPS = 50;

interface CategoryResponses {
  name: string;
  summaries: string[];
}

interface Task {
  title: string;
  timeValue: number;
  timeUnit: string;
  color?: string;
  progress?: number;
}

function getScreenDimensions(): { width: number; height: number } {
  const primaryDisplay = screen.getPrimaryDisplay();
  return primaryDisplay.size;
}

function getAiScaledScreenDimensions(): { width: number; height: number } {
  const { width, height } = getScreenDimensions();
  const aspectRatio = width / height;

  let scaledWidth: number;
  let scaledHeight: number;

  if (aspectRatio > 1280 / 800) {
    // Width is the limiting factor
    scaledWidth = 1280;
    scaledHeight = Math.round(1280 / aspectRatio);
  } else {
    // Height is the limiting factor
    scaledHeight = 800;
    scaledWidth = Math.round(800 * aspectRatio);
  }

  return { width: scaledWidth, height: scaledHeight };
}

const getScreenshot = async (): Promise<string> => {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const aiDimensions = getAiScaledScreenDimensions();

  // Find chromeless window and temporarily make it transparent
  const chromelessWindow = BrowserWindow.getAllWindows().find(
    (window) => window.getTitle() === 'Chromeless Window',
  );
  console.log('CHROMELESS WINDOW', chromelessWindow);
  const originalOpacity = chromelessWindow?.getOpacity() || 1;

  if (chromelessWindow) {
    chromelessWindow.setOpacity(0);
    // Longer delay to ensure the window is fully hidden
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  try {
    return await hideWindowBlock(async () => {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height },
      });
      const primarySource = sources[0]; // Assuming the first source is the primary display

      if (primarySource) {
        const screenshot = primarySource.thumbnail;
        // Resize the screenshot to AI dimensions
        const resizedScreenshot = screenshot.resize(aiDimensions);
        // Convert the resized screenshot to a base64-encoded PNG
        const base64Image = resizedScreenshot.toPNG().toString('base64');
        return base64Image;
      }
      throw new Error('No display found for screenshot');
    });
  } finally {
    // Restore chromeless window opacity after screenshot
    if (chromelessWindow) {
      // Longer delay before showing to ensure screenshot is complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      // chromelessWindow.setOpacity(originalOpacity);
    }
  }
};

const mapToAiSpace = (x: number, y: number) => {
  const { width, height } = getScreenDimensions();
  const aiDimensions = getAiScaledScreenDimensions();
  return {
    x: (x * aiDimensions.width) / width,
    y: (y * aiDimensions.height) / height,
  };
};

const mapFromAiSpace = (x: number, y: number) => {
  const { width, height } = getScreenDimensions();
  const aiDimensions = getAiScaledScreenDimensions();
  return {
    x: (x * width) / aiDimensions.width,
    y: (y * height) / aiDimensions.height,
  };
};

const promptForAction = async (
  runHistory: BetaMessageParam[],
): Promise<BetaMessageParam> => {
  // Strip images from all but the last message
  const historyWithoutImages = runHistory.map((msg, index) => {
    if (index === runHistory.length - 1) return msg; // Keep the last message intact
    if (Array.isArray(msg.content)) {
      return {
        ...msg,
        content: msg.content.map((item) => {
          if (item.type === 'tool_result' && typeof item.content !== 'string') {
            return {
              ...item,
              content: item.content?.filter((c) => c.type !== 'image'),
            };
          }
          return item;
        }),
      };
    }
    return msg;
  });

  const message = await anthropic.beta.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    tools: [
      {
        type: 'computer_20241022',
        name: 'computer',
        display_width_px: getAiScaledScreenDimensions().width,
        display_height_px: getAiScaledScreenDimensions().height,
        display_number: 1,
      },
      {
        name: 'finish_run',
        description:
          'Call this function when you have achieved the goal of the task.',
        input_schema: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Whether the task was successful',
            },
            error: {
              type: 'string',
              description: 'The error message if the task was not successful',
            },
          },
          required: ['success'],
        },
      },
    ],
    system: `The user will ask you to perform a task and you should use their computer to do so. After each step, take a screenshot and carefully evaluate if you have achieved the right outcome. Explicitly show your thinking: "I have evaluated step X..." If not correct, try again. Only when you confirm a step was executed correctly should you move on to the next one. Note that you have to click into the browser address bar before typing a URL. You should always call a tool! Always return a tool call. Remember call the finish_run tool when you have achieved the goal of the task. Do not explain you have finished the task, just call the tool. Use keyboard shortcuts to navigate whenever possible.`,
    // tool_choice: { type: 'any' },
    messages: historyWithoutImages,
    betas: ['computer-use-2024-10-22'],
  });

  return { content: message.content, role: message.role };
};

export const performAction = async (action: NextAction) => {
  switch (action.type) {
    case 'mouse_move':
      const { x, y } = mapFromAiSpace(action.x, action.y);
      await mouse.setPosition(new Point(x, y));
      break;
    case 'left_click_drag':
      const { x: dragX, y: dragY } = mapFromAiSpace(action.x, action.y);
      const currentPosition = await mouse.getPosition();
      await mouse.drag([currentPosition, new Point(dragX, dragY)]);
      break;
    case 'cursor_position':
      const position = await mouse.getPosition();
      const aiPosition = mapToAiSpace(position.x, position.y);
      // TODO: actually return the position
      break;
    case 'left_click':
      await mouse.leftClick();
      break;
    case 'right_click':
      await mouse.rightClick();
      break;
    case 'middle_click':
      await mouse.click(Button.MIDDLE);
      break;
    case 'double_click':
      await mouse.doubleClick(Button.LEFT);
      break;
    case 'type':
      // Set typing delay to 0ms for instant typing
      keyboard.config.autoDelayMs = 0;
      await keyboard.type(action.text);
      // Reset delay back to default if needed
      keyboard.config.autoDelayMs = 500;
      break;
    case 'key':
      const keyMap = {
        Return: Key.Enter,
      };
      const keys = action.text.split('+').map((key) => {
        const mappedKey = keyMap[key as keyof typeof keyMap];
        if (!mappedKey) {
          throw new Error(`Tried to press unknown key: ${key}`);
        }
        return mappedKey;
      });
      await keyboard.pressKey(...keys);
      break;
    case 'screenshot':
      // Don't do anything since we always take a screenshot after each step
      break;
    default:
      throw new Error(`Unsupported action: ${action.type}`);
  }
  return '';
};

// console.log('JSON:', chatResponse.choices[0].message.content);

export const getNextScreenshot = async (
  recordScreenDir: string,
  replayScreens: boolean,
  screenFiles: string[],
): Promise<{ image: string; is_screenshot: boolean }> => {
  // Capture a screenshot or replay a recorded screenshot

  if (screenFiles.length > 0) {
    // replaying screens
    const screenFile = screenFiles.shift();
    if (screenFile == undefined) {
      throw new Error(`List size > 0, but shift failed`);
    }
    console.log('RECORDED SCREEN', screenFile);
    return {
      image: fs.readFileSync(screenFile, 'base64'),
      is_screenshot: false,
    };
  }

  console.log('TAKE SCREENSHOT');
  const screenBase64 = await getScreenshot();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filePath = path.join(recordScreenDir, `screenshot-${timestamp}.png`);
  fs.writeFileSync(filePath, screenBase64, 'base64');
  console.log('SCREEN RECORDED', filePath);
  return { image: screenBase64, is_screenshot: true };
};

// export const getTasks = async (
//   client: Mistral,
//   instructions: string,
// ): Promise<any> => {
//   const chatResponseTasks = await client.chat.complete({
//     responseFormat: { type: 'json_object' },
//     model: 'mistral-small-latest',
//     messages: [
//       {
//         role: 'user',
//         content: [
//           {
//             type: 'text',
//             text: `an array named "tasks" of objects with the following properties: title (e.g. "Write a blog post"), timeValue: (e.g. 10), timeUnit (seconds, minutes or hours), e.g.
//             Use as little words to describe the task as possible. If the instruction is "I am working on code" then the task should be "Code". So try to be as concise as possible.
//             Example output:
// {
//   "tasks": [
//     {
//       "title": "Write a blog post",
//       "timeValue": 10,
//       "timeUnit": "minutes"
//     },
//     {
//       "title": "Write a blog post",
//       "timeValue": 2,
//       "timeUnit": "hours"
//     }
//   ]
// }
// `,
//           },
//           {
//             type: 'text',
//             text: instructions || '',
//           },
//         ],
//       },
//     ],
//   });

//   const tasks = chatResponseTasks.choices?.[0]?.message?.content
//     ? JSON.parse(chatResponseTasks.choices[0].message.content as string)?.tasks
//     : { tasks: [] } || [];

//   // write tasks to tasks.json
//   fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
//   return tasks;
// };

export const postProcessData = async (
  client: Mistral,
  postProcessingData: CategoryResponses[],
): Promise<any> => {
  const msg = [];

  for (const category of postProcessingData) {
    console.log('CATEGORY', category.name);

    const chatResponseTasks = await client.chat.complete({
      responseFormat: { type: 'json_object' },
      model: 'mistral-small-latest',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `an json formatted list containing 2 elements or less that precisely describes the listed activities that are separated with semicolon. Use as little words to describe each element as possible. Try to be as concise as possible.\
            Example output:
            {
              "activities": [
                "Writing in JavaScript in the context of a project involving tracking and tagging activities.",
                "The user is writing a Python script."
                ]
                }`,
            },
            {
              type: 'text',
              text: category.summaries.join('; '), // join all summaries with a semicolon
            },
          ],
        },
      ],
    });
    console.log(
      'CHAT RESPONSE',
      chatResponseTasks.choices?.[0]?.message?.content as string,
    );

    // const tasks = chatResponseTasks.choices?.[0]?.message?.content
    //   ? JSON.parse(chatResponseTasks.choices[0].message.content as string)?.tasks
    //   : { tasks: [] } || [];

    //    // write tasks to tasks.json
    //   fs.writeFileSync('tasks.json', JSON.stringify(tasks, null, 2));
  }
  // return tasks;
};

export const getRequest = async (
  client: Mistral,
  tasks: any,
  screenBase64: string,
): Promise<{
  response: any;
  json: {
    task: string;
    summary: string;
  };
}> => {
  // text: 'Summarize what the user is doing in this screenshot. Just reply with one single sentence. Be very specific. Don\'t say "the user is working" or "the user is coding", instead mention the project they are working on or the subject of the email they are looking at or writing, and to whom they are writing. Only focus on the biggest visible application window.',
  const ai_prompt = `Given this set of Tasks and a screenshot, determine which task the user is working on.

  For the task take one from the following list:
  ${tasks.map((t: any) => t.title).join(', ')}

  If the user is not working on any of the tasks, respond with "Other".

  Summarize what the user is doing in this screenshot. Be very specific. Avoid generic statements like "the user is working" or "the user is coding."
  Instead, provide details such as the project they are working on, the subject of the email they are writing or reading, and to whom they are writing.

  Focus only on the largest visible application window.

  Example output:
  {
    "task": "Research",
    "summary": "The user is writing a JavaScript file named 'runAgent.ts', which is part of a project involving tracking and tagging activities."
  }`;

  let jsonLine = '';

  const chatResponse = await client.chat.complete({
    responseFormat: { type: 'json_object' },
    model: 'pixtral-12b',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: ai_prompt,
          },
          {
            type: 'image_url',
            imageUrl: `data:image/jpeg;base64,${screenBase64}`,
          },
        ],
      },
    ],
  });

  console.dir(chatResponse, { depth: null });

  // Save timestamp and sentence to JSONL file
  const timestamp = Date.now();
  if (chatResponse.choices && chatResponse.choices.length > 0) {
    const sentence = chatResponse.choices[0].message.content;
    jsonLine = `${JSON.stringify({
      timestamp,
      sentence,
    })}\n`;

    // Create the file if it doesn't exist
    if (!fs.existsSync('activity_log.jsonl')) {
      fs.writeFileSync('activity_log.jsonl', '');
    }
    fs.appendFileSync('activity_log.jsonl', jsonLine);
    if (typeof sentence === 'string') {
      const { task } = JSON.parse(sentence);
      const { summary } = JSON.parse(sentence);
      return { response: chatResponse, json: { task, summary } };
    }
  }
  return { response: chatResponse, json: { task: '', summary: '' } };
};

export const readRecordedScreens = async (
  recordScreenBase: string,
): Promise<string[]> => {
  let screenFiles: string[] = [];
  const directories = fs.readdirSync(recordScreenBase, {
    withFileTypes: true,
    recursive: false,
  });
  while (directories.length > 0) {
    const dir = directories.shift();
    if (dir == undefined) {
      break;
    }
    if (dir.isDirectory()) {
      console.log('READING RECORD DIR', dir.name);
      const files = fs.readdirSync(path.join(recordScreenBase, dir.name));
      const filteredFiles = files.filter((f) => f.endsWith('.png'));
      if (filteredFiles.length > 0) {
        const pathFiles = filteredFiles.map((f) =>
          path.join(recordScreenBase, dir.name, f),
        );
        console.log('found files: #', pathFiles.length);
        screenFiles = screenFiles.concat(pathFiles);
      }
    }
  }
  return screenFiles;
};

export const appendResponseToPostProcessingData = async (
  postProcessingData: CategoryResponses[],
  content: {
    task: string;
    summary: string;
  },
): Promise<CategoryResponses[]> => {
  // load string with json content in a variable
  console.log('CONTENT', content);
  if (content.task != '') {
    // add the content to the postProcessingData array
    let found = false;
    for (const category of postProcessingData) {
      if (category.name == content.task) {
        console.log('ADDING NEW TASK TO CATEGORY', content.task);
        category.summaries.push(content.summary);
        found = true;
        break;
      }
    }
    if (found == false) {
      console.log('ADDING NEW CATEGORY', content.task);
      postProcessingData.push({
        name: content.task,
        summaries: [content.summary],
      });
    }
    console.log('POST PROCESSING DATA', postProcessingData);
  } else {
    console.log('NO TASK FOUND - CANNOT BE ASSIGNED TO CATEGORY');
  }
  return postProcessingData;
};

export const runAgent = async (
  setState: (state: AppState) => void,
  getState: () => AppState,
) => {
  setState({
    ...getState(),
    running: true,
    runHistory: [{ role: 'user', content: getState().instructions ?? '' }],
    error: null,
  });

  // wait for 3 seconds
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // ToDo: replace with UI interface
  const replayScreens = false;

  let recordScreenDir = '';
  let screenFiles: string[] = [];

  console.log('INITIALIZING');

  const recordScreenBaseDir = './_recorded_screens';
  // Create the directory for recorded screens
  if (replayScreens == true) {
    // create subdirectory for each program launch
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    recordScreenDir = path.join(recordScreenBaseDir, `${timestamp}`);
    fs.mkdirSync(recordScreenDir, { recursive: true });
    // load all recorded screens (there might be some old ones laying around - load them all)
    screenFiles = await readRecordedScreens(recordScreenBaseDir);
    console.log('RECORDED SCREENS', screenFiles);
  }

  const apiKey = process.env.MISTRAL_API_KEY;
  const client = new Mistral({ apiKey });

  console.log('START RUNNING with instructions:', getState().instructions);

  console.log('GET TASKS', getState().instructions || '');
  const { tasks } = getState();

  // const tasks = await getTasks(client, getState().instructions || '');
  // setState({
  //   ...getState(),
  //   tasks,
  // });

  console.log('TASKS', tasks);

  // define an array of categories which have a name and a list of tasks. Name the array 'postProcessingData'
  let postProcessingData: CategoryResponses[] = [];
  let firstCategoryRecognized = false;

  while (getState().running) {
    // Make chromeless window transparent before taking screenshot
    const chromelessWindow = BrowserWindow.getAllWindows().find(
      (window) => window.getTitle() === 'Chromeless Window',
    );
    if (chromelessWindow) {
      chromelessWindow.setOpacity(0);
    }

    const screenData = await getNextScreenshot(
      recordScreenDir,
      replayScreens,
      screenFiles,
    );

    console.log('SCREEN', screenData.image.slice(0, 100));
    console.time('mistral-request');
    const chatRsp = await getRequest(client, tasks, screenData.image);
    const chatResponse = chatRsp.response;
    console.timeEnd('mistral-request');
    console.dir(chatResponse, { depth: null });

    // Send category update to chromeless window and make it visible again
    BrowserWindow.getAllWindows().forEach((window) => {
      if (window.getTitle() === 'Chromeless Window') {
        // Find the matching task to get its color and progress
        const task = tasks.find((t: Task) => t.title === chatRsp.json.task);

        window.webContents.send('category-update', {
          name: chatRsp.json.task,
          color: task?.color || '#607D8B',
          progress: task?.progress || 0,
        });

        // Make window visible after getting response
        if (firstCategoryRecognized) {
          window.setOpacity(1);
        } else if (chatRsp.json.task) {
          firstCategoryRecognized = true;
          window.setOpacity(1);
        }
      }
    });

    postProcessingData = await appendResponseToPostProcessingData(
      postProcessingData,
      chatRsp.json,
    );
    await postProcessData(client, postProcessingData);

    if (screenData.is_screenshot === true) {
      // no more screens to replay, wait for
      await new Promise((resolve) => {
        setTimeout(resolve, 5000);
      });
    }
  }
};
