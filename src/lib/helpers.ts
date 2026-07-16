import momo from "$lib/assets/outlet-icons/dumpling.svg";
import fish from "$lib/assets/outlet-icons/fish.svg";
import hotpot from "$lib/assets/outlet-icons/hotbowl.svg";
import kebab from "$lib/assets/outlet-icons/kebab.svg";
import traditional from "$lib/assets/outlet-icons/wheat.svg";
import bun from "$lib/assets/outlet-icons/bakery.svg";
import ricebowl from "$lib/assets/outlet-icons/ricebowl.svg";
import fries from "$lib/assets/outlet-icons/fries.svg";
import juice from "$lib/assets/outlet-icons/juice.svg";

const outletIcons: Record<string, string> = {
    "1": momo,
    "2": fish,
    "3": hotpot,
    "4": kebab,
    "5": traditional,
    "6": bun,
    "7": juice,
    "8": ricebowl,
    "9": fries,
};

function mapStoreIcon(shopNo: string): string {
    return outletIcons[shopNo] ?? bun;
}

export default { mapStoreIcon };
