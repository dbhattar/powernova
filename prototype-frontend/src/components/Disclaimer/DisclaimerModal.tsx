import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function DisclaimerModal() {
  return (
    <Dialog defaultOpen>
      <DialogContent
        className="sm:max-w-[650px] overflow-auto"
        onPointerDownOutside={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="">Disclaimer</DialogTitle>
        </DialogHeader>
        <hr className="my-2" />
        <div className="max-h-[60vh] space-y-4 overflow-y-auto text-base text-muted-foreground">
          <p>
            The information provided in this tool include publicly available
            transmission information provided by transmission organizations and
            generation information collected from generation interconnection
            entities and local regulatory authorities. While Cosmic Global
            Technology makes every effort to ensure the accuracy of the data
            provided, Cosmic Global Technology makes no guarantee either
            expressly or implied for the outcome of an interconnection request
            made based on the information provided in this tool.
          </p>
          <p>
            Currently you are in demo mode, which is based on static data
            extracted at a certain time which may be obsolete now.
          </p>
          <p className="gap-2 italic">
            For more details about our product and services, visit{" "}
            <a
              href="https://cosmicglobaltech.com"
              className="text-blue-700 hover:text-blue-500 underline"
            >
              https://cosmicglobaltech.com
            </a>
          </p>
        </div>
        <hr className="my-2" />
        <DialogFooter>
          <DialogTrigger asChild>
            <Button type="submit">I Accept</Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
