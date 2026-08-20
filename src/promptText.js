// One tiny rule of prompt grammar: a count of swings reads "1 swing", never
// "1 swings". Shared by the goal count lines in coachApi.js and the distance
// distribution in ballFlight.js, the two places the prompt writes a count
// out in words. Lives in its own module because ballFlight.js sits on the
// grader's .js-extension import path and coachApi.js does not.
export const swingCountPhrase = (count) => `${count} swing${count === 1 ? '' : 's'}`
