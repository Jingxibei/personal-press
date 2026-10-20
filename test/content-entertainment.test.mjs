import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEntertainment, countSudokuSolutions } from '../src/core/entertainment.mjs';

const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];

test('Sudoku is deterministic, has exactly one solution and stores answers separately', () => {
  const result = makeEntertainment('2026-10-20', ['en', 'ja']);
  assert.deepEqual(makeEntertainment('2026-10-20', ['en', 'ja']), result);
  assert.notDeepEqual(makeEntertainment('2026-10-21').sudoku.grid, result.sudoku.grid);
  const { grid, solution } = result.sudoku;
  assert.equal(countSudokuSolutions(grid), 1);
  assert.ok(grid.flat().some(value => value === 0));
  for (let row = 0; row < 9; row++) {
    assert.deepEqual([...solution[row]].sort(), digits);
    assert.deepEqual(solution.map(line => line[row]).sort(), digits);
    for (let col = 0; col < 9; col++) if (grid[row][col]) assert.equal(grid[row][col], solution[row][col]);
  }
  for (let blockRow = 0; blockRow < 3; blockRow++) for (let blockCol = 0; blockCol < 3; blockCol++) {
    const block = [];
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) block.push(solution[blockRow * 3 + row][blockCol * 3 + col]);
    assert.deepEqual(block.sort(), digits);
  }
  assert.notStrictEqual(grid, solution);
});

test('invalid Sudoku clues are detected instead of being published as solvable', () => {
  const { grid } = makeEntertainment('2026-10-20').sudoku;
  grid[0][0] = 1;
  grid[0][1] = 1;
  assert.equal(countSudokuSolutions(grid), 0);
  assert.equal(countSudokuSolutions([[1, 2, 3]]), 0);
});

test('all miniature word-square answers cross correctly and have localized original clues', () => {
  const seen = new Set();
  for (let day = 1; day <= 12; day++) {
    const leisure = makeEntertainment(`2026-10-${String(day).padStart(2, '0')}`);
    const puzzle = leisure.crossword;
    seen.add(puzzle.solution.flat().join(''));
    assert.equal(puzzle.clues.across.length, 3);
    assert.equal(puzzle.clues.down.length, 3);
    for (let row = 0; row < 3; row++) {
      assert.equal(puzzle.solution[row].join(''), puzzle.solution.map(line => line[row]).join(''));
      assert.deepEqual(puzzle.grid[row], ['', '', '']);
    }
    for (const clue of [...puzzle.clues.across, ...puzzle.clues.down]) for (const language of ['zh-CN', 'en', 'ja']) assert.ok(clue.clue[language]);
    assert.match(puzzle.note.en, /English letters/);
    assert.match(leisure.notice.en, /repeat/);
  }
  assert.equal(seen.size, 3);
});

test('riddles and jokes offer Chinese, English and Japanese without commercial cartoon content', () => {
  const leisure = makeEntertainment('2026-10-20', ['zh-CN', 'ja']);
  for (const language of ['zh-CN', 'en', 'ja']) {
    assert.ok(leisure.riddle.question[language]);
    assert.ok(leisure.riddle.answer[language]);
    assert.ok(leisure.joke.text[language]);
  }
  assert.equal(leisure.origin, 'local-original-v0.1');
  assert.equal(leisure.cartoon, undefined);
  assert.deepEqual(leisure.languages, ['zh-CN', 'ja']);
});
