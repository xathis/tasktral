import {
  Box,
  Heading,
  HStack,
  List,
  ListItem,
  Slider,
  SliderFilledTrack,
  SliderMark,
  SliderThumb,
  SliderTrack,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { data as demoData } from './demo/data';

// Get unique categories and assign colors
const COLORS = [
  '#4CAF50',
  '#2196F3',
  '#FFC107',
  '#FF5722',
  '#9C27B0',
  '#795548',
  '#607D8B',
];
const uniqueCategories = [...new Set(demoData.map((entry) => entry.category))];
const categoryColors = Object.fromEntries(
  uniqueCategories.map((category, index) => [
    category,
    COLORS[index % COLORS.length],
  ]),
);

// Process demo data into hourly statistics

const processData = () => {
  console.log('Starting data processing');
  console.log('Demo data:', demoData);

  const hourlyStats = Array(24)
    .fill(null)
    .map(() => ({}));
  const startOfDay = new Date('2025-01-18T08:00:00Z').getTime();
  const endOfDay = new Date('2025-01-18T20:00:00Z').getTime();

  console.log('Time range:', {
    start: new Date(startOfDay).toISOString(),
    end: new Date(endOfDay).toISOString(),
  });

  // Filter data for the specific day and count time spent in each category per hour
  const dayData = demoData.filter(
    (entry) => entry.time >= startOfDay && entry.time < endOfDay,
  );

  console.log('Filtered day data:', dayData);

  dayData.forEach((entry, index) => {
    const hour = new Date(entry.time).getUTCHours();
    const duration =
      index < dayData.length - 1
        ? (dayData[index + 1].time - entry.time) / 1000 / 60 // minutes until next entry
        : 60; // Last entry gets 60 minutes

    console.log('Processing entry:', {
      hour,
      category: entry.category,
      duration,
      time: new Date(entry.time).toISOString(),
    });

    hourlyStats[hour][entry.category] =
      (hourlyStats[hour][entry.category] || 0) + duration;
  });

  console.log('Hourly stats before percentage:', hourlyStats);

  // Convert to percentage and format for the chart
  const formattedData = hourlyStats
    .map((hour, index) => {
      const total =
        Object.values(hour).reduce(
          (sum: number, val: number) => sum + val,
          0,
        ) || 60;
      const stats = { hour: index.toString().padStart(2, '0') };
      Object.entries(hour).forEach(([category, minutes]) => {
        stats[category] = ((minutes as number) / total) * 100;
      });
      return stats;
    })
    .slice(8, 21); // Only keep hours 8-20

  console.log('Final formatted data:', formattedData);
  return formattedData;
};

const chartData = processData();

interface StatsProps {
  onCancel: () => void;
}

export function Stats({ onCancel }: StatsProps) {
  const [granularity, setGranularity] = useState<string>('chilled');

  const handleSliderChange = (value: number) => {
    if (value <= 33) setGranularity('chilled');
    else if (value <= 66) setGranularity('normal');
    else setGranularity('nuclear');
  };

  return (
    <Box p={4} position="relative">
      {/* Navigation */}
      <HStack justify="space-between" mb={8}>
        <Text color="gray.400" onClick={onCancel} cursor="pointer">
          {'< Previous'}
        </Text>
        <Text
          color="gray.400"
          sx={{
            '-webkit-app-region': 'drag',
            cursor: 'move', // Visual indicator that it's draggable
          }}
        >
          Yesterday
        </Text>
        <Text>Next &gt;</Text>
      </HStack>

      {/* Main content */}
      <HStack align="flex-start" spacing={8}>
        {/* Left side - Stats */}
        <VStack align="flex-start" flex={1}>
          <Heading size="xl" mb={4}>
            Stats
          </Heading>
          <Box w="full" h="400px">
            <BarChart
              width={500}
              height={400}
              data={chartData}
              margin={{
                top: 20,
                right: 30,
                left: 20,
                bottom: 40,
              }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="hour"
                label={{ value: 'Hour (UTC)', position: 'bottom', dy: 35 }}
                tick={{ dy: 10 }}
              />
              <YAxis
                label={{ value: 'Percent', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              <Legend
                verticalAlign="top"
                align="center"
                layout="horizontal"
                iconSize={10}
                wrapperStyle={{
                  lineHeight: '40px', // This increases vertical spacing between legend items
                }}
              />
              {uniqueCategories.map((category) => (
                <Bar
                  key={category}
                  dataKey={category}
                  stackId="a"
                  fill={categoryColors[category]}
                />
              ))}
            </BarChart>
          </Box>
        </VStack>

        {/* Right side - Summary */}
        <VStack align="flex-start" flex={1}>
          <Heading size="xl" mb={4}>
            Summary
          </Heading>

          {/* Granularity Slider */}
          <Box w="full" pt={6} pb={8} px={8}>
            <Slider
              defaultValue={0}
              min={0}
              max={100}
              step={50}
              onChange={handleSliderChange}
            >
              <SliderMark value={0} mt={4} ml={-2} fontSize="sm">
                Chilled
              </SliderMark>
              <SliderMark value={50} mt={4} ml={-4} fontSize="sm">
                Normal
              </SliderMark>
              <SliderMark value={100} mt={4} ml={-12} fontSize="sm">
                NUCLEAR
              </SliderMark>
              <SliderTrack>
                <SliderFilledTrack />
              </SliderTrack>
              <SliderThumb />
            </Slider>
          </Box>
          {granularity === 'chilled' && (
            <List spacing={2}>
            {uniqueCategories.map((category) => {
              const totalMinutes = demoData
              .filter((entry) => entry.category === category)
              .reduce((sum, entry, index, array) => {
                const nextEntry = array[index + 1];
                const duration =
                nextEntry && nextEntry.category === category
                  ? (nextEntry.time - entry.time) / 1000 / 60
                  : 0;
                return sum + duration;
              }, 0);
              return (
              <ListItem key={category}>
                • {category} ({Math.round(totalMinutes)}m)
              </ListItem>
              );
            })}
            </List>
          )}
          {granularity === 'normal' && (
            <List spacing={2}>
              {uniqueCategories.map((category) => (
              <ListItem key={category}>
                • {category}
                <List spacing={1} pl={4} fontSize="sm">
                {Array.from(
                  new Set(
                  demoData
                    .filter((entry) => entry.category === category)
                    .map((entry) => entry.summary),
                  ),
                ).map((summary, index) => (
                  <ListItem key={index} title={summary}>
                  •{' '}
                  {summary.length > 130
                    ? `${summary.substring(0, 130)}...`
                    : summary}
                  </ListItem>
                ))}
                </List>
              </ListItem>
              ))}
            </List>
          )}
          {granularity === 'nuclear' && (
            <List spacing={2} pl={4} fontSize="sm">
              {demoData.reduce((acc, entry, index, array) => {
              const duration =
                index < array.length - 1
                ? (array[index + 1].time - entry.time) / 1000 / 60
                : 60;

              if (
                acc.length > 0 &&
                acc[acc.length - 1].category === entry.category &&
                acc[acc.length - 1].summary === entry.summary
              ) {
                acc[acc.length - 1].duration += duration;
                acc[acc.length - 1].endTime = entry.time;
              } else {
                acc.push({
                ...entry,
                duration,
                endTime: entry.time,
                });
              }

              return acc;
              }, []).map((entry, index) => (
              <ListItem key={index}>
                • {new Date(entry.time).toLocaleTimeString()} -{' '}
                {entry.category} ({Math.round(entry.duration)}m) -{' '}
                <span title={entry.summary}>
                {entry.summary.length > 60
                  ? `${entry.summary.substring(0, 60)}...`
                  : entry.summary}
                </span>
              </ListItem>
              ))}
            </List>
          )}
        </VStack>
      </HStack>
    </Box>
  );
}
