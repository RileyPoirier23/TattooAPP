// Which booking questions apply to a pro's business category. A pro with no category was created
// before categories existed, when every pro was a tattoo artist.

/** Tattoos have a size (width × height). */
export const asksSize = (category: string) => !category || /tattoo/i.test(category);

/** Tattoos and piercings go somewhere on the body. */
export const asksPlacement = (category: string) => !category || /tattoo|pierc/i.test(category);
