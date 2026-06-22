import Momo from "$lib/assets/eatright-icons/DUMPL.svg";
import Fish from "$lib/assets/eatright-icons/FISH.svg";
import Hotpot from "$lib/assets/eatright-icons/HOT.svg";
import Kebab from "$lib/assets/eatright-icons/KB.svg";
import Traditional from "$lib/assets/eatright-icons/RI.svg";
import Bun from "$lib/assets/eatright-icons/1F950.svg";
import Juice from "$lib/assets/eatright-icons/TEA.svg";
import Organic from "$lib/assets/eatright-icons/WHE.svg";
import Fries from "$lib/assets/eatright-icons/FF.svg";

export default {
    /**
     * Method to map outlet icons to the given shop number
     * @param shopNo 
     * @returns Path to SVG icon asset
     */
    mapOutletIcons(shopNo: string) {
        const outletIcons: Record<string, string> = {
            "1": Momo,
            "2": Fish,
            "3": Hotpot,
            "4": Kebab,
            "5": Traditional,
            "6": Bun,
            "7": Juice,
            "8": Organic,
            "9": Fries,
        };
        return outletIcons[shopNo] || "";
    }
}