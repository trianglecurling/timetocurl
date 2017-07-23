import { TimeToCurl } from "./TimeToCurl";

// Force compilation and bundling
import "./StandardTimerUI";
import "./SimpleTimerUI";

require("./style.scss");

new TimeToCurl().init();
console.log(
	"Hey developers! Thanks for checking out the source of Time to Curl. The JavaScript included on this page is compiled from TypeScript source. I don't do source maps because source maps are for wimps. To see the original source, head on over to our GitHub repo at https://github.com/trianglecurling/timetocurl. Please use the GitHub page to let us know if you find any issues with this application.",
);
console.log(
	'Those looking a bit more closely may notice that the layout of this page is fairly horrendous. Lots of overlayed DIVs with absolute positioning—yuck! Here\'s my reasoning. When I first created the app, I started with the most bare-bones HTML possible with almost no CSS. Once I got a good amount of the functionality done, I decided to go back and add CSS to skin the app. However, the plan was to make the first skin as similar as possible to "CurlTime" to make for an easy transition. However, I wanted to keep my options open for re-skinning in the future, so I wanted the HTML to be easily modified without affecting the "Classic" layout. We\'ll see in time if that was a good decision. I\'m starting to regret it!',
);
