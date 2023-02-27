# JS13K TypeScript Starter WebGL

**This starter kit is designed to have a powerful but easy-to-use build process allowing you to focus on building your
game rather than how to shrink it.**

## Features
JS13k TypeScript Starter does the following for you automatically:

* Minifies your code with [Google Closure Compiler](https://developers.google.com/closure/compiler)
* Minifies WebGL shaders with [Shader_Minifier](https://github.com/laurentlb/Shader_Minifier)
* Minifies your HTML and CSS
* Compresses all the above with [RoadRoller](https://github.com/lifthrasiir/roadroller) (see [RoadRoller wiki](https://github.com/lifthrasiir/roadroller/wiki) for details)
* Compresses the RoadRollered `index.html` file and any additional assets (images, etc) with [ECT](https://github.com/fhanau/Efficient-Compression-Tool)

If you do not want to use WebGL, [use the non-WebGL version.](https://github.com/roblouie/js13k-typescript-starter)


## Quick Start

Install dependencies: `npm install`

Run Server: `npm run serve`

## Project Details
Included demo code lets you navigate a menu and launch into a simple interactive
screen where you can move a basketball around while simple WebGL shaders change the background.

While the running code is purposely minimal, allowing you to build whatever game you'd like, it does come with some
basic helpful game related code:


#### Simple State Machine 
Easily manage multiple states, run setup and teardown code when switching, and pass variables
  to states on change. Used in the included demo to switch from the menu to a level, but useful for enemy states, player states, etc.

#### Responsive Fullscreen
The main canvas will always fill as much of the screen as it can while maintaining a 16:9
  aspect ratio. There is also a fullscreen toggle on the menu to go completely fullscreen.

#### Locked 60 FPS by Default
A surprising number of games are unplayable each year when they run at 2x (or more)
  the intended speed. Screens with a refresh rate higher than 60hz are very common. For easy consistency,
  the framerate is locked at 60. However, the game state does take in an interval argument, so this could instead be
  used to update your physics with an interval, allowing you to unlock the framerate.


#### Controls Wrapper with Controller Support
Play with a keyboard or connect a controller to play. Includes button mapping for Xbox controllers and support for analog deadzone.

## Starter Kit Build Features
While developing, simply use `npm run serve` to start a server and get hot module reloading.

### WebGL

The `serve` command will automatically look for changes to any file ending in `.glsl` and run the shader minification plugin.
You can configure this plugin in `vite.config.ts`, including turning it off completely if you don't want to use it.

```ts
const shaderMinifyConfig = {
  shouldMinify: true,                // Turn the plugin on or off
  shaderDirectory: './src/web-gl',   // The directory where your shaders are stored
  output: './src/web-gl/shaders.ts', // The path and name of the file to output
  debounce: 2000,                    // Configure debounce time
};
```

As configured here in the demo app, any time a `.glsl` file is created or updated, all shaders in `./src/web-gl` will
automatically be minified and placed in `./src/web-gl/shaders.ts`. As this can take a couple seconds, a debounce is added
to stop the command from running after every single text change.

Any uniforms, attributes, or outputs you define in your shader will become exported variables from the output file. This
allows you to get those positions and use them in your TypeScript code. The contents of the shader files will also be
exported as strings, the variable names will be the filenames with any `.` being replaced by `_`.

So in the demo where I have two shader files, `fragment.glsl` and `vertex.glsl`, and a few variables defined in each,
my output `shaders.ts` file looks like this:

```ts
export const aPosition = 'm';
export const fragColor = 'e';
export const uBallPosition = 'v';
export const uBallVelocity = 'f';
export const vColor = 'h';

export const fragment_glsl = `#version 300 es
precision highp float;uniform vec2 v,f;out vec4 e;void main(){float m=length(f)/20.;e=vec4(m,fract((gl_FragCoord.xy-v)/vec2(3840,2160)),1);}`;

export const vertex_glsl = `#version 300 es
layout(location=0) in vec4 m;out vec4 h;void main(){gl_Position=m;}`;
```

### Building
For building, `npm run build`:
* Minifies your html file and embeds css
* Strips html/css from your html and prepends your transpiled js code with a `document.write` call that writes your html and css.
* Runs google closure compiler on your code
* Runs RoadRoller on the closure minified code
* Creates `dist/index.html` with only a script tag and the RoadRollered JS
* Any external assets (images, data files, etc) are also copied to `dist/`
* Zips everything up and places it in `dist/index.zip`

### Build Output
```
dist/
  index.html   <-- Final index.html file here for easy testing without unzipping
  output.js    <-- Closure minified. Not used anywhere but useful for debugging minification
  ball.png     <-- Any assets are copied from to the root of dist for smaller size
  index.zip    <-- Final zipped file with index.html and any other asset files.
```

### Shrink More with `find-best-roadroller` and `build-with-best-roadroller`
The regular build process runs RoadRollers regular build. It spends a couple minutes finding a config and
then compresses your code. This means every build takes 2+ minutes, and it doesn't really have time to find
the best compression config. This is why I have added two scripts: 

`npm run find-best-roadroller`: Will ask you how many seconds to search for a better config. It will run as long as you tell it, 
or until it runs out of room in the buffer, and save the config to `./roadroller-config.json`.

`npm run build-with-best-roadroller`: Runs the same build process as the regular build, except it tells RoadRoller to
use the config from `./roadroller-config.json`. Not only will this save you a decent amount of space 
(~40 bytes on average in my experience), it also runs much faster, as rather than spending 2 minutes re-figuring out
the config, it uses the one you found.

Note that the more you change your code, the less optimal the stored config will be, so you'll want to find a new best
config after any major changes. However, you don't really need to do any of this until you're ready build a final zip file.

## ESLint and Minifier Reserved Words

The ESLint config included is extremely lax, which considering the nature of the competition to write the smallest code
possible is maybe to be expected. I've included it largely for one small feature, `id-denylist`. It will warn you if
you use property names defined in this list.

Every JS minifier I've tried (Closure, Terser, and SWC) keeps a list of reserved property names that it will not minify.
It does this to try to prevent bugs in the minified code. It sees something like `.scale`, `.rotate`, or `.children`,
and thinks you might be wanting to use those properties to set css, modify a canvas, or access element children. Even if
you provide type information and never use these properties in that way, the minifiers are not smart enough to know this.

To avoid lots of unminified property names in your code, avoid using these reserved words (unless of course you are doing the thing they are reserved for). This eslint setting will help
you find any. It is not an exhaustive list however, and it's worth checking `dist/output.js` occasionally for non-minified
properties.
